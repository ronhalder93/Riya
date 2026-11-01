const API_BASE = 'https://riya-api-plnn.onrender.com';

const messagesEl = document.querySelector('#messages');
const form = document.querySelector('#chatForm');
const input = document.querySelector('#messageInput');
const micButton = document.querySelector('#micBtn');
const stateLabel = document.querySelector('#activityState');
const voiceToggle = document.querySelector('#voiceToggle');
const chatHistoryToggle = document.querySelector('#chatHistoryToggle');
const fileInput = document.querySelector('#fileInput');
const attachBtn = document.querySelector('#attachBtn');
const attachmentList = document.querySelector('#attachmentList');
const video = document.querySelector('#cameraPreview');
const cameraToggle = document.querySelector('#cameraToggle');
const cameraStop = document.querySelector('#cameraStop');
const cameraNotice = document.querySelector('#cameraNotice');
const qualitySelect = document.querySelector('#qualitySelect');

let recognition = null;
let speechTimer = null;
let voiceEnabled = true;
let cameraStream = null;
let attachments = [];

const sizes = { 144: [256, 144], 240: [426, 240], 360: [640, 360], 480: [854, 480], 720: [1280, 720] };

function addMessage(text, role) {
  const node = document.createElement('div');
  node.className = 'bubble ' + role;
  node.textContent = text;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function loadHistory() {
  try {
    JSON.parse(localStorage.getItem('riya-chat') || '[]').slice(-30)
      .forEach((m) => addMessage(m.text, m.role));
  } catch {}
}

function saveHistory(text, role) {
  let items = [];
  try { items = JSON.parse(localStorage.getItem('riya-chat') || '[]'); } catch {}
  items.push({ text, role, at: Date.now() });
  try { localStorage.setItem('riya-chat', JSON.stringify(items.slice(-100))); } catch {}
}


function inferLocalAvatarAction(message, reply) {
  const text = (String(message || '') + ' ' + String(reply || '')).toLowerCase();
  const action = { mood: 'neutral', gaze: 'camera', gesture: 'none', body: 'idle', pose: 'natural' };

  if (/\b(love you|miss you|kiss|jaan|baby|babe|darling|pyaar|प्यार|जान|किस|😘|❤️|💕)\b/i.test(text)) {
    action.mood = 'love';
    action.gesture = 'heart';
  } else if (/\b(haha|lol|funny|joke| मजाक|हंस|হাসি)\b/i.test(text)) {
    action.mood = 'happy';
    action.gesture = 'ok';
  } else if (/\b(sad|upset|lonely|hurt| रोना|दुखी|উদাস|কষ্ট)\b/i.test(text)) {
    action.mood = 'sad';
    action.gesture = 'side';
  } else if (/\b(happy|great|awesome| अच्छा|खुश|বাহ|ভালো)\b/i.test(text)) {
    action.mood = 'happy';
    action.gesture = 'thumbup';
  }

  if (/\b(sit|baith|बैठ|বসো)\b/i.test(text)) action.body = 'sit';
  else if (/\b(walk|come here|come closer|idhar aao|पास आ|এদিকে এসো)\b/i.test(text)) {
    action.body = 'walk';
    action.move_x = 0;
    action.move_z = 0.2;
  }
  return action;
}

function setAvatarState(next) {
  if (stateLabel) stateLabel.textContent = String(next).toUpperCase();
}

function speak(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
  utterance.rate = 1;
  utterance.onstart = () => setAvatarState('talking');
  utterance.onend = () => setAvatarState('ready');
  speechSynthesis.speak(utterance);
}

async function fetchWithRetry(url, options, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 500 && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('RIYA server is unavailable');
}

async function getAvatarAction(message, reply, history) {
  try {
    const response = await fetchWithRetry(API_BASE + '/api/avatar-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, reply, history }),
    }, 1);
    if (!response.ok) throw new Error('Avatar action API ' + response.status);
    const action = await response.json();
    if (!action || typeof action !== 'object') throw new Error('Invalid avatar action');
    return action;
  } catch {
    return inferLocalAvatarAction(message, reply);
  }
}

async function sendMessage(text) {
  const clean = text.trim();
  if (!clean && !attachments.length) return;

  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('riya-chat') || '[]').slice(-11, -1)
      .filter((x) => ['user', 'assistant'].includes(x.role))
      .map((x) => ({ role: x.role, content: x.text.slice(0, 2000) }));
  } catch {}

  const attachmentNote = attachments.length
    ? ' [Attached locally: ' + attachments.map((f) => f.name).join(', ') + ']'
    : '';
  const outgoing = clean + attachmentNote;

  addMessage(outgoing, 'user');
  saveHistory(outgoing, 'user');
  input.value = '';
  attachments = [];
  renderAttachments();
  setAvatarState('thinking');

  try {
    const response = await fetchWithRetry(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: clean || 'Please help with the attached file names: ' + attachmentNote,
        history,
      }),
    });
    if (!response.ok) throw Error('API ' + response.status);
    const data = await response.json();
    addMessage(data.reply, 'assistant');
    saveHistory(data.reply, 'assistant');
    // Use the backend conversation-aware director; fall back locally only if it is unavailable.
    const action = await getAvatarAction(clean, data.reply, history);
    if (window.riyaApplyAction) window.riyaApplyAction(action);
    else window.riyaPendingAction = action;
    if (Number.isFinite(action.move_x) && Number.isFinite(action.move_z)) {
      window.riyaMoveTo?.(action.move_x, action.move_z);
    }
    speak(data.reply);
    if (!voiceEnabled) setAvatarState('ready');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(
      () => setAvatarState('ready'),
      Math.min(5000, Math.max(1400, data.reply.length * 28))
    );
  } catch {
    const reply = 'RIYA server se abhi connection nahi ho pa raha. Thodi der baad dobara try karo.';
    addMessage(reply, 'assistant');
    saveHistory(reply, 'assistant');
    speak(reply);
    setAvatarState('ready');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(input.value);
});

attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  attachments.push(...Array.from(fileInput.files || []));
  renderAttachments();
  fileInput.value = '';
});

function renderAttachments() {
  attachmentList.textContent = attachments.length
    ? attachments.map((f) => f.name).join(' · ') + ' (names only)'
    : '';
}

if (chatHistoryToggle) {
  chatHistoryToggle.addEventListener('click', () => {
    const hidden = messagesEl.classList.toggle('chat-hidden');
    chatHistoryToggle.textContent = hidden ? 'Show chat' : 'Hide chat';
    chatHistoryToggle.setAttribute('aria-expanded', String(!hidden));
  });
}

voiceToggle.addEventListener('click', (e) => {
  voiceEnabled = !voiceEnabled;
  e.currentTarget.textContent = voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF';
  e.currentTarget.setAttribute('aria-pressed', String(voiceEnabled));
  if (!voiceEnabled && 'speechSynthesis' in window) speechSynthesis.cancel();
});

micButton.addEventListener('click', () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    addMessage('Voice input is not supported in this browser. You can type instead.', 'assistant');
    return;
  }
  if (!recognition) {
    recognition = new SR();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.onresult = (e) => { input.value = e.results[0][0].transcript; };
    recognition.onerror = () => {
      setAvatarState('ready');
      addMessage('Microphone recognition stopped.', 'assistant');
    };
    recognition.onend = () => setAvatarState('ready');
  }
  try {
    recognition.start();
    setAvatarState('listening');
  } catch {
    setAvatarState('ready');
  }
});

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraNotice.textContent = 'Camera needs a supported browser over HTTPS.';
    return;
  }
  cameraToggle.disabled = true;
  try {
    const [width, height] = sizes[qualitySelect.value];
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: width }, height: { ideal: height } },
    });
    video.srcObject = cameraStream;
    video.classList.add('active');
    await video.play();
    cameraToggle.textContent = 'Camera ON';
    cameraStop.disabled = false;
    cameraNotice.textContent = 'Camera preview is on · this device only';
    setAvatarState('camera on');
  } catch (err) {
    cameraNotice.textContent = err.name === 'NotAllowedError'
      ? 'Camera permission was not granted.'
      : 'Could not start camera: ' + err.message;
  } finally {
    cameraToggle.disabled = false;
  }
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
  cameraStream = null;
  video.srcObject = null;
  video.classList.remove('active');
  cameraToggle.textContent = 'Start camera';
  cameraStop.disabled = true;
  cameraNotice.textContent = 'Camera is off';
  setAvatarState('ready');
}

cameraToggle.addEventListener('click', startCamera);
cameraStop.addEventListener('click', stopCamera);
qualitySelect.addEventListener('change', () => {
  if (cameraStream) { stopCamera(); startCamera(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && cameraStream) stopCamera();
});

// Remove legacy manual Wave/Heart/Hug controls. Avatar gestures remain chat-driven.
function removeLegacyMotionButtons() {
  document.querySelectorAll('.riya-motion-controls, .riya-motion-button, [data-action="wave"], [data-action="heart"], [data-action="hug"], button[aria-label="Wave"], button[aria-label="Heart"], button[aria-label="Hug"]').forEach((node) => node.remove());
  document.querySelectorAll('button').forEach((button) => {
    const label = (button.getAttribute('aria-label') || button.textContent || '').replace(/\p{Extended_Pictographic}/gu, '').trim().toLowerCase();
    if (label === 'wave' || label === 'heart' || label === 'hug') button.remove();
  });
}
removeLegacyMotionButtons();
new MutationObserver(removeLegacyMotionButtons).observe(document.documentElement, { childList: true, subtree: true });

loadHistory();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
                }
