const API_BASE = 'https://riya-api-plnn.onrender.com';
const WORKLET = 'https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/modules/headworklet.mjs';
const MODEL = 'https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/dist/model-en-mixed.bin';
const AVATAR = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.8/avatars/brunette.glb';

const mount = document.getElementById('scene');
const fallback = document.getElementById('avatarFallback');
const stateLabel = document.getElementById('avatarState');
let room = null;
let headaudio = null;
let head = null;
let Room = null;
let RoomEvent = null;
let Track = null;

function setState(value) {
  if (stateLabel) stateLabel.textContent = value.toUpperCase();
}

let pendingChatReaction = null;

// Translate chat intent into actions supported by the current TalkingHead character.
// This is a lightweight front-end bridge; it does not alter the protected conversation backend.
function reactToChat(userText, replyText = '') {
  const text = (String(userText || '') + ' ' + String(replyText || '')).toLowerCase();
  let reaction = { mood: 'happy', gesture: 'handup', duration: 1.8 };

  if (/pappi|papa|kiss|chumma|chum|muah|😘/.test(text)) {
    reaction = { mood: 'happy', gesture: '😘', duration: 2.4 };
  } else if (/hug|jhappi|gale lag|🤗/.test(text)) {
    reaction = { mood: 'happy', gesture: '🤗', duration: 2.4 };
  } else if (/thank|shukriya|dhanyavaad|thanks|🙏/.test(text)) {
    reaction = { mood: 'happy', gesture: 'thumbup', duration: 1.8 };
  } else if (/love you|i love|pyaar|pyar|❤️|💕/.test(text)) {
    reaction = { mood: 'happy', gesture: '❤️', duration: 2.2 };
  } else if (/sorry|udaas|sad|dukhi|😢|😭/.test(text)) {
    reaction = { mood: 'sad', gesture: '🤗', duration: 2.0 };
  } else if (/gussa|angry|naraz|😠|😡/.test(text)) {
    reaction = { mood: 'angry', gesture: 'shrug', duration: 1.6 };
  } else if (/hello|hi\b|hey|namaste|salaam|good morning|good night/.test(text)) {
    reaction = { mood: 'happy', gesture: 'handup', duration: 1.8 };
  } else if (/yes|haan|bilkul|correct|sahi|great|awesome|wah|😍|😊/.test(text)) {
    reaction = { mood: 'happy', gesture: 'thumbup', duration: 1.8 };
  } else if (/no\b|nahin|nahi|not sure|pata nahi|maybe|kyun|why\b/.test(text)) {
    reaction = { mood: 'surprised', gesture: 'shrug', duration: 1.8 };
  }

  if (!head) {
    pendingChatReaction = reaction;
    return;
  }
  try {
    head.setMood?.(reaction.mood);
    head.playGesture?.(reaction.gesture, reaction.duration);
    head.lookAtCamera?.(700);
  } catch (err) {
    console.warn('RIYA character reaction could not play:', err);
  }
}

window.riyaReactToChat = reactToChat;

if (mount) {
  setState('loading');
  try {
    const { TalkingHead } = await import('talkinghead');
    head = new TalkingHead(mount, {
      lipsyncModules: ['en'],
      cameraView: 'upper',
      modelFPS: 30,
      modelPixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      avatarMood: 'neutral',
      avatarIdleEyeContact: 0.4,
      avatarSpeakingEyeContact: 0.8,
    });

    await head.showAvatar({
      url: AVATAR,
      body: 'F',
      avatarMood: 'neutral',
      lipsyncLang: 'en',
    });

    window.riyaHead = head;
    if (fallback) fallback.classList.add('hidden');
    setState('ready');
    if (pendingChatReaction) {
      const queued = pendingChatReaction;
      pendingChatReaction = null;
      reactToChat('', queued.gesture);
    }

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
