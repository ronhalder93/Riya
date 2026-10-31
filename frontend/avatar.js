import { TalkingHead } from 'talkinghead';
import { HeadAudioNode } from 'https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/modules/headaudio.mjs';
import { Room, RoomEvent, Track } from 'https://cdn.jsdelivr.net/npm/livekit-client@2/+esm';

const API_BASE = 'https://riya-api-plnn.onrender.com';
const WORKLET = 'https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/modules/headworklet.mjs';
const MODEL = 'https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@main/dist/model-en-mixed.bin';
const AVATAR = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.8/avatars/brunette.glb';

const mount = document.getElementById('scene');
const fallback = document.getElementById('avatarFallback');
let room = null;
let headaudio = null;
let head = null;

try {
  head = new TalkingHead(mount, {
    lipsyncModules: ['en'],
    cameraView: 'upper',
    cameraDistance: 0.35,
    modelFPS: 30,
    modelPixelRatio: Math.min(devicePixelRatio, 1.5),
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

  await head.audioCtx.audioWorklet.addModule(WORKLET);
  headaudio = new HeadAudioNode(head.audioCtx, {
    processorOptions: {},
    parameterData: { vadGateActiveDb: -40, vadGateInactiveDb: -60, speakerMeanHz: 220 },
  });
  await headaudio.loadModel(MODEL);

  headaudio.onvalue = (key, value) => {
    if (head.mtAvatar[key]) {
      Object.assign(head.mtAvatar[key], { newvalue: value, needsUpdate: true });
    }
  };
  head.opt.update = headaudio.update.bind(headaudio);
  headaudio.onstarted = () => head.lookAtCamera(400);
} catch (err) {
  console.error('Avatar init failed:', err);
  if (fallback) fallback.classList.remove('hidden');
}

const btn = document.createElement('button');
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

function resetBtn() {
  btn.textContent = '📞 Call';
  btn.style.background = '#2b6cb0';
}

async function startCall() {
  if (room || !head) return;
  btn.textContent = 'Connecting…';
  try {
    await head.audioCtx.resume();
    const res = await fetch(API_BASE + '/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_name: 'riya-' + Date.now(), participant_name: 'guest' }),
    });
    if (!res.ok) throw new Error('token ' + res.status);
    const { url, token } = await res.json();

    room = new Room({ adaptiveStream: true });
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const stream = new MediaStream([track.mediaStreamTrack]);
      const src = head.audioCtx.createMediaStreamSource(stream);
      src.connect(headaudio);
      src.connect(head.audioCtx.destination);
    });
    room.on(RoomEvent.Disconnected, endCall);

    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    btn.textContent = '📴 End';
    btn.style.background = '#c53030';
  } catch (err) {
    console.error('Call failed:', err);
    room = null;
    resetBtn();
  }
}

function endCall() {
  if (room) {
    room.disconnect();
    room = null;
  }
  resetBtn();
}

btn.addEventListener('click', () => (room ? endCall() : startCall()));
