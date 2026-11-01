
const API_BASE = 'https://riya-api-plnn.onrender.com';
const WORKLET = 'https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/modules/headworklet.mjs';
const MODEL = 'https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/dist/model-en-mixed.bin';
const DEFAULT_AVATAR = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.8/avatars/brunette.glb';
// A production character can be supplied without changing the avatar runtime.
// Set window.RIYA_AVATAR_URL before avatar.js loads; incompatible models fall back safely.
const AVATAR = typeof window.RIYA_AVATAR_URL === 'string' && window.RIYA_AVATAR_URL.trim()
  ? window.RIYA_AVATAR_URL.trim()
  : DEFAULT_AVATAR;

const mount = document.getElementById('scene');
const fallback = document.getElementById('avatarFallback');
const stateLabel = document.getElementById('avatarState');
let room = null;
let headaudio = null;
let head = null;
let bodyPose = 'natural';
let Room = null;
let RoomEvent = null;
let Track = null;

function setState(value) {
  if (stateLabel) stateLabel.textContent = value.toUpperCase();
}

// Use a locally hosted, generated bedroom image as the scene environment.
// The base64 asset keeps the room available offline with the app shell.
if (mount) {
  const backdrop = document.createElement('div');
  backdrop.className = 'room-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  mount.appendChild(backdrop);
  fetch('./room-image.b64')
    .then((response) => {
      if (!response.ok) throw new Error('Room image unavailable');
      return response.text();
    })
    .then((encoded) => {
      const clean = encoded.trim();
      if (clean.startsWith('/9j/')) {
        backdrop.style.backgroundImage = 'url("data:image/jpeg;base64,' + clean + '")';
        backdrop.classList.add('loaded');
      }
    })
    .catch((error) => console.warn('RIYA room backdrop unavailable:', error));
}

if (mount) {
  setState('loading');
  try {
    const { TalkingHead } = await import('talkinghead');
    head = new TalkingHead(mount, {
      lipsyncModules: ['en'],
      cameraView: 'full',
      modelFPS: 30,
      modelPixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      avatarMood: 'neutral',
      avatarIdleEyeContact: 0.4,
      avatarSpeakingEyeContact: 0.8,
    });

    const avatarOptions = {
      body: 'F',
      avatarMood: 'neutral',
      lipsyncLang: 'en',
    };
    try {
      await head.showAvatar({ ...avatarOptions, url: AVATAR });
    } catch (customAvatarError) {
      if (AVATAR === DEFAULT_AVATAR) throw customAvatarError;
      console.warn('Configured RIYA character could not load; restoring the bundled demo avatar:', customAvatarError);
      setState('restoring demo avatar');
      await head.showAvatar({ ...avatarOptions, url: DEFAULT_AVATAR });
    }

    window.riyaHead = head;
    window.riyaApplyAction = (action = {}) => {
      if (!head) return;
      const moods = ['neutral', 'happy', 'angry', 'sad', 'fear', 'disgust', 'love', 'sleep'];
      const gestures = ['none', 'handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'kiss', 'heart'];
      const mood = moods.includes(action.mood) ? action.mood : 'neutral';
      const gesture = gestures.includes(action.gesture) ? action.gesture : 'none';
      const body = ['idle', 'walk', 'sit'].includes(action.body) ? action.body : 'idle';
      const poses = ['natural', 'wave', 'thinking', 'open_arms', 'cross_arms', 'dance', 'lean_in', 'nod', 'playful', 'shy'];
      bodyPose = poses.includes(action.pose) ? action.pose : 'natural';
      try {
        if (window.riyaBodyAction) window.riyaBodyAction(body);
        head.setMood(mood);
        if (action.gaze === 'forward') head.lookAhead(900);
        else head.lookAtCamera(900);
        if (gesture === 'kiss') head.playGesture('😘', 2.5, false, 350);
        else if (gesture === 'heart') head.playGesture('😍', 2.5, false, 350);
        else if (gesture !== 'none') head.playGesture(gesture, 2.5, false, 350);
      } catch (actionError) {
        console.warn('RIYA avatar action could not be played:', actionError);
      }
    };
    if (fallback) fallback.classList.add('hidden');
    setState('ready');

    // Let the user preview a locally supplied GLB without committing a large,
    // potentially licensed character asset to the repository.
    const avatarFileInput = document.getElementById('avatarFileInput');
    const avatarUploadButton = document.getElementById('avatarUploadButton');
    let selectedAvatarUrl = AVATAR;
    let selectedAvatarObjectUrl = null;
    if (avatarUploadButton && avatarFileInput) {
      avatarUploadButton.addEventListener('click', () => avatarFileInput.click());
      avatarFileInput.addEventListener('change', async () => {
        const file = avatarFileInput.files?.[0];
        avatarFileInput.value = '';
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.glb') || file.size > 100 * 1024 * 1024) {
          showCallStatus('Choose a GLB file smaller than 100 MB');
          return;
        }
        const nextUrl = URL.createObjectURL(file);
        avatarUploadButton.disabled = true;
        setState('loading custom avatar');
        showCallStatus('Loading selected 3D avatar…');
        try {
          await head.showAvatar({ ...avatarOptions, url: nextUrl });
          const previousObjectUrl = selectedAvatarObjectUrl;
          selectedAvatarObjectUrl = nextUrl;
          selectedAvatarUrl = nextUrl;
          if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
          setState('custom avatar ready');
          showCallStatus('Custom avatar loaded for this session');
        } catch (loadError) {
          URL.revokeObjectURL(nextUrl);
          console.warn('RIYA custom GLB could not be loaded:', loadError);
          try {
            await head.showAvatar({ ...avatarOptions, url: selectedAvatarUrl });
            setState(selectedAvatarUrl === DEFAULT_AVATAR ? 'ready' : 'custom avatar ready');
            showCallStatus('That GLB was not compatible; previous avatar restored');
          } catch (restoreError) {
            console.error('RIYA avatar restore failed:', restoreError);
            setState('avatar error');
            showCallStatus('Avatar could not be restored. Refresh the page.');
          }
        } finally {
          avatarUploadButton.disabled = false;
        }
      });
    }
    window.addEventListener('beforeunload', () => {
      if (selectedAvatarObjectUrl) URL.revokeObjectURL(selectedAvatarObjectUrl);
    }, { once: true });

    // Audio-driven lip sync is optional: never let an add-on failure hide the avatar.
    try {
      const { HeadAudioNode } = await import('https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/modules/headaudio.mjs');
      await head.audioCtx.audioWorklet.addModule(WORKLET);
      headaudio = new HeadAudioNode(head.audioCtx, {
        processorOptions: {},
        parameterData: { vadGateActiveDb: -40, vadGateInactiveDb: -60, speakerMeanHz: 220 },
      });
      await headaudio.loadModel(MODEL);
      headaudio.onvalue = (key, value) => {
        if (head?.mtAvatar?.[key]) {
          Object.assign(head.mtAvatar[key], { newvalue: value, needsUpdate: true });
        }
      };
      head.opt.update = headaudio.update.bind(headaudio);
      headaudio.onstarted = () => head.lookAtCamera(400);
    } catch (audioError) {
      console.warn('RIYA lip-sync add-on unavailable; avatar remains active:', audioError);
    }

    // Procedural full-body motion on the existing Mixamo-style skeleton.
    // No external animation files or paid services are required.
    const motionBoneNames = [
      'Hips', 'Spine', 'Spine1', 'Spine2',
      'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm',
      'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'Neck', 'Head',
      'RightUpLeg', 'RightLeg', 'RightFoot',
    ];
    const motionBones = new Map();
    motionBoneNames.forEach((name) => {
      const bone = head.armature?.getObjectByName(name);
      if (bone) {
        motionBones.set(name, {
          bone,
          position: bone.position.clone(),
          rotation: bone.rotation.clone(),
        });
      }
    });
    const hasLegRig = ['Hips', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg']
      .every((name) => motionBones.has(name));
    let bodyMotion = 'idle';
        let bodyMotionBlend = 0;
    let bodyMotionPhase = 0;
    const avatarRoot = head.armature;
    const roomPosition = { x: avatarRoot.position.x, z: avatarRoot.position.z };
    const roomTarget = { x: roomPosition.x, z: roomPosition.z };
    let roomMoving = false;

    // Move the actual 3D avatar root across the room plane. The room is currently
    // a 2D photographic backdrop, so keep movement within a conservative visible area.
    window.riyaMoveTo = (x, z) => {
      if (!avatarRoot?.position || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      roomTarget.x = Math.max(-0.75, Math.min(0.75, x));
      roomTarget.z = Math.max(-0.35, Math.min(0.35, z));
      roomMoving = Math.hypot(roomTarget.x - avatarRoot.position.x, roomTarget.z - avatarRoot.position.z) > 0.025;
      bodyMotion = roomMoving ? 'walk' : 'idle';
      return true;
    };
    window.riyaStopMoving = () => {
      roomTarget.x = avatarRoot.position.x;
      roomTarget.z = avatarRoot.position.z;
      roomMoving = false;
      bodyMotion = 'idle';
    };

    window.riyaBodyAction = (action = 'idle') => {
      if (!hasLegRig) {
        showCallStatus('This avatar model has no compatible full-body leg rig');
        return false;
      }
      if (['idle', 'walk', 'sit'].includes(action)) {
        bodyMotion = action;
        showCallStatus(action === 'walk' ? 'Walking' : action === 'sit' ? 'Sitting pose' : 'Standing');
        return true;
      }
      return false;
    };

    if (window.riyaPendingAction) {
      window.riyaApplyAction(window.riyaPendingAction);
      delete window.riyaPendingAction;
    }

    function updateBodyMotion(dt) {
      if (!hasLegRig || !head?.armature) return;
      const step = Math.min(Math.max(dt || 0, 0), 0.05);
      bodyMotionPhase += step * 6.2;
      const target = bodyMotion === 'idle' ? 0 : 1;
      bodyMotionBlend += (target - bodyMotionBlend) * Math.min(1, step * 3.2);
      const walk = bodyMotion === 'walk' ? bodyMotionBlend : 0;
      if (roomMoving) {
        const dx = roomTarget.x - avatarRoot.position.x;
        const dz = roomTarget.z - avatarRoot.position.z;
        const distance = Math.hypot(dx, dz);
        const travel = Math.min(distance, step * 0.42);
        if (distance > 0.015) {
          avatarRoot.position.x += (dx / distance) * travel;
          avatarRoot.position.z += (dz / distance) * travel;
          avatarRoot.rotation.y = Math.atan2(dx, dz);
        } else {
          avatarRoot.position.x = roomTarget.x;
          avatarRoot.position.z = roomTarget.z;
          roomMoving = false;
          bodyMotion = 'idle';
        }
      }
      const sit = bodyMotion === 'sit' ? bodyMotionBlend : 0;
      const swing = Math.sin(bodyMotionPhase);
      const liftL = Math.max(0, swing);
      const liftR = Math.max(0, -swing);

      const apply = (name, rx = 0, ry = 0, rz = 0, py = 0) => {
        const base = motionBones.get(name);
        if (!base) return;
        base.bone.position.set(base.position.x, base.position.y + py, base.position.z);
        base.bone.rotation.set(
          base.rotation.x + rx * (walk + sit),
          base.rotation.y + ry * (walk + sit),
          base.rotation.z + rz * (walk + sit),
        );
      };

      // Alternating, low-amplitude steps; knee and arm counter-swing.
      apply('Hips', 0.025 * sit, 0, 0, -0.18 * sit + Math.abs(swing) * 0.018 * walk);
      apply('Spine', -0.12 * sit, 0, 0);
      apply('Spine1', -0.08 * sit, 0, 0);
      apply('Spine2', -0.04 * sit, 0, 0);
      apply('LeftUpLeg', -0.78 * sit + 0.42 * swing * walk);
      apply('RightUpLeg', -0.78 * sit - 0.42 * swing * walk);
      apply('LeftLeg', 1.18 * sit + 0.52 * liftR * walk);
      apply('RightLeg', 1.18 * sit + 0.52 * liftL * walk);
      apply('LeftFoot', -0.18 * sit - 0.18 * liftR * walk);
      apply('RightFoot', -0.18 * sit - 0.18 * liftL * walk);
      apply('LeftArm', 0.28 * sit - 0.26 * swing * walk);
      apply('RightArm', 0.28 * sit + 0.26 * swing * walk);
      apply('LeftForeArm', -0.18 * sit);
      apply('RightForeArm', -0.18 * sit);

      // Conversation-selected procedural poses. These use the existing rig and
      // blend gently rather than pretending unavailable animation clips exist.
      const poseWeight = 1;
      const wavePulse = Math.sin(bodyMotionPhase * 2.8);
      const setPose = (name, rx = 0, ry = 0, rz = 0) => {
        const base = motionBones.get(name);
        if (!base) return;
        base.bone.rotation.x += rx * poseWeight;
        base.bone.rotation.y += ry * poseWeight;
        base.bone.rotation.z += rz * poseWeight;
      };
      if (bodyPose === 'wave') {
        setPose('RightArm', -1.05 + wavePulse * 0.12, 0, -0.28);
        setPose('RightForeArm', -0.45 + wavePulse * 0.22, 0, -0.12);
      } else if (bodyPose === 'thinking') {
        setPose('RightArm', -0.72, 0, -0.42);
        setPose('RightForeArm', -1.05, 0, 0.12);
        setPose('Neck', -0.10, 0.08, 0);
      } else if (bodyPose === 'open_arms') {
        setPose('LeftArm', -0.12, 0, 0.82);
        setPose('RightArm', -0.12, 0, -0.82);
        setPose('LeftForeArm', -0.25, 0, 0.12);
        setPose('RightForeArm', -0.25, 0, -0.12);
      } else if (bodyPose === 'cross_arms') {
        setPose('LeftArm', -0.28, 0, -0.48);
        setPose('RightArm', -0.28, 0, 0.48);
        setPose('LeftForeArm', -1.05, 0, -0.22);
        setPose('RightForeArm', -1.05, 0, 0.22);
      } else if (bodyPose === 'dance') {
        setPose('Spine', Math.sin(bodyMotionPhase * 2) * 0.12, 0, Math.sin(bodyMotionPhase) * 0.12);
        setPose('LeftArm', -0.62 + wavePulse * 0.22, 0, 0.45);
        setPose('RightArm', -0.62 - wavePulse * 0.22, 0, -0.45);
        setPose('LeftForeArm', -0.42, 0, 0.12);
        setPose('RightForeArm', -0.42, 0, -0.12);
      } else if (bodyPose === 'lean_in') {
        setPose('Spine', -0.16, 0, 0);
        setPose('Spine1', -0.12, 0, 0);
        setPose('Neck', 0.08, 0, 0);
      } else if (bodyPose === 'nod') {
        setPose('Neck', Math.sin(bodyMotionPhase * 3.5) * 0.12, 0, 0);
        setPose('Head', Math.sin(bodyMotionPhase * 3.5) * 0.08, 0, 0);
      } else if (bodyPose === 'playful') {
        setPose('Spine', -0.07, 0, 0.06);
        setPose('Neck', 0.04, 0, -0.10);
        setPose('Head', 0.02, 0, -0.08);
        setPose('RightArm', -0.62 + wavePulse * 0.04, 0, -0.32);
        setPose('RightForeArm', -0.82, 0, -0.10);
      } else if (bodyPose === 'shy') {
        setPose('Neck', 0.08, 0, 0.12);
        setPose('Head', 0.04, 0, 0.10);
        setPose('LeftArm', -0.48, 0, 0.34);
        setPose('LeftForeArm', -0.88, 0, 0.12);
        setPose('RightArm', -0.36, 0, -0.22);
      }

      // Gentle breathing keeps the avatar from looking frozen between gestures.
      // Apply it on top of the procedural pose without requiring another asset.
      const breath = Math.sin(bodyMotionPhase * 0.32) * 0.012;
      const torso = motionBones.get('Spine2');
      if (torso) torso.bone.rotation.x = torso.rotation.x + breath;
      const upperTorso = motionBones.get('Spine1');
      if (upperTorso) upperTorso.bone.rotation.z =
        upperTorso.rotation.z + Math.sin(bodyMotionPhase * 0.16) * 0.004;
    }

    const audioUpdate = head.opt.update;
    head.opt.update = (dt) => {
      if (typeof audioUpdate === 'function') audioUpdate(dt);
      updateBodyMotion(dt);
    };
    if (!hasLegRig) console.warn('RIYA full-body procedural motion disabled: compatible leg bones were not found.');
  } catch (err) {
    console.error('RIYA avatar failed to initialize:', err);
    setState('avatar error');
    if (fallback) {
      fallback.textContent = 'Avatar could not load. Please refresh and try again.';
      fallback.classList.remove('hidden');
    }
  }
}

const btn = document.createElement('button');
btn.type = 'button';
btn.textContent = '📞 Call';
Object.assign(btn.style, {
  position: 'fixed',
  right: '16px',
  bottom: '196px',
  zIndex: '25',
  padding: '12px 18px',
  borderRadius: '999px',
  border: '0',
  background: '#2b6cb0',
  color: '#fff',
  fontWeight: '600',
});
document.body.appendChild(btn);

const callStatus = document.createElement('div');
callStatus.setAttribute('role', 'status');
callStatus.setAttribute('aria-live', 'polite');
callStatus.textContent = 'Call ready';
Object.assign(callStatus.style, {
  position: 'fixed',
  right: '16px',
  bottom: '252px',
  zIndex: '25',
  maxWidth: 'min(280px, calc(100vw - 32px))',
  padding: '8px 12px',
  borderRadius: '12px',
  background: 'rgba(21, 24, 33, 0.88)',
  color: '#fff',
  fontSize: '12px',
  lineHeight: '1.4',
});
document.body.appendChild(callStatus);

function showCallStatus(value) {
  callStatus.textContent = value;
}

function resetBtn(status = 'Call ready') {
  btn.textContent = '📞 Call';
  btn.style.background = '#2b6cb0';
  btn.disabled = false;
  showCallStatus(status);
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + ' timed out after ' + Math.round(ms / 1000) + ' seconds')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function startCall() {
  if (room || !head) return;
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  showCallStatus('Connecting to LiveKit…');

  let activeRoom = null;
  try {
    if (!Room) {
      ({ Room, RoomEvent, Track } = await import('https://cdn.jsdelivr.net/npm/livekit-client@2/+esm'));
    }
    await head.audioCtx.resume();

    showCallStatus('Requesting secure call access…');
    const res = await withTimeout(fetch(API_BASE + '/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_name: 'riya-' + Date.now(), participant_name: 'guest' }),
    }), 15000, 'Token request');
    if (!res.ok) throw new Error('Token request failed (HTTP ' + res.status + ')');
    const { url, token } = await res.json();
    if (!url || !token) throw new Error('Server returned an incomplete LiveKit token');

    activeRoom = new Room({ adaptiveStream: true });
    room = activeRoom;

    activeRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      try {
        const stream = new MediaStream([track.mediaStreamTrack]);
        const src = head.audioCtx.createMediaStreamSource(stream);
        if (headaudio) {
          src.connect(headaudio);
          src.connect(head.audioCtx.destination);
        } else {
          src.connect(head.audioCtx.destination);
        }
        showCallStatus('Riya audio connected');
      } catch (audioErr) {
        console.error('RIYA remote audio setup failed:', audioErr);
        showCallStatus('Connected, but remote audio setup failed');
      }
    });

    activeRoom.on(RoomEvent.ParticipantConnected, () => {
      showCallStatus('Riya joined the call');
    });

    activeRoom.on(RoomEvent.Disconnected, () => {
      if (room === activeRoom) room = null;
      resetBtn('Call disconnected');
    });

    showCallStatus('Joining LiveKit room…');
    await withTimeout(activeRoom.connect(url, token), 20000, 'LiveKit room connection');
    showCallStatus('Room connected. Starting microphone…');
    await withTimeout(activeRoom.localParticipant.setMicrophoneEnabled(true), 12000, 'Microphone setup');

    btn.textContent = '📴 End';
    btn.style.background = '#c53030';
    btn.disabled = false;
    showCallStatus('Connected. Waiting for Riya to join…');
  } catch (err) {
    console.error('RIYA call failed:', err);
    if (room === activeRoom) room = null;
    if (activeRoom) {
      try { await activeRoom.disconnect(); } catch (disconnectErr) {
        console.warn('RIYA cleanup after call failure:', disconnectErr);
      }
    }
    const message = err?.message || String(err);
    resetBtn('Call failed: ' + message);
  }
}

function endCall() {
  const activeRoom = room;
  room = null;
  if (activeRoom) {
    try { activeRoom.disconnect(); } catch (err) {
      console.warn('RIYA disconnect failed:', err);
    }
  }
  resetBtn('Call ended');
}

btn.addEventListener('click', () => (room ? endCall() : startCall()));


// Restore camera eye contact after a short idle interval. Pause while hidden
// and respect reduced-motion preferences.
let idleAttentionTimer = null;
function scheduleIdleAttention() {
  clearTimeout(idleAttentionTimer);
  if (document.hidden || !head || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  idleAttentionTimer = setTimeout(() => {
    try { head.lookAtCamera(1100); } catch {}
    scheduleIdleAttention();
  }, 18000);
}
document.addEventListener('visibilitychange', scheduleIdleAttention);
scheduleIdleAttention();
