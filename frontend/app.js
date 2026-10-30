import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const API_BASE = 'https://riya-api-plnn.onrender.com';
const messagesEl = document.querySelector('#messages');
const form = document.querySelector('#chatForm');
const input = document.querySelector('#messageInput');
const speechToggle = document.querySelector('#speechToggle');
let voiceEnabled = true;
let recognition = null;

function addMessage(text, role) {
  const node = document.createElement('div');
  node.className = `bubble ${role}`;
  node.textContent = text;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function loadHistory() {
  try {
    const items = JSON.parse(localStorage.getItem('riya-chat') || '[]');
    items.slice(-30).forEach(m => addMessage(m.text, m.role));
  } catch { /* ignore malformed local history */ }
}
function saveHistory(text, role) {
  let items = [];
  try { items = JSON.parse(localStorage.getItem('riya-chat') || '[]'); } catch {}
  items.push({text, role, at: Date.now()});
  localStorage.setItem('riya-chat', JSON.stringify(items.slice(-100)));
}

async function sendMessage(text) {
  const clean = text.trim();
  if (!clean) return;
  addMessage(clean, 'user'); saveHistory(clean, 'user'); input.value = '';
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({message: clean, history: []})
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    addMessage(data.reply, 'assistant'); saveHistory(data.reply, 'assistant');
    if (voiceEnabled && speechToggle.checked && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(data.reply);
      utterance.lang = /[\u0900-\u097F]/.test(data.reply) ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
    }
  } catch {
    const reply = 'I can’t reach the RIYA server right now. Check that the backend is running and the API URL is configured.';
    addMessage(reply, 'assistant'); saveHistory(reply, 'assistant');
  }
}
form.addEventListener('submit', e => { e.preventDefault(); sendMessage(input.value); });
document.querySelector('#clearBtn').addEventListener('click', () => {
  localStorage.removeItem('riya-chat'); messagesEl.replaceChildren();
  addMessage('Chat history cleared on this browser.', 'assistant');
  window.speechSynthesis?.cancel();
});
document.querySelector('#muteBtn').addEventListener('click', e => {
  voiceEnabled = !voiceEnabled;
  e.currentTarget.setAttribute('aria-pressed', String(!voiceEnabled));
  e.currentTarget.innerHTML = voiceEnabled ? '🔊 <span>Voice on</span>' : '🔇 <span>Voice muted</span>';
  if (!voiceEnabled) window.speechSynthesis?.cancel();
});
document.querySelector('#settingsBtn').addEventListener('click', () => document.querySelector('#settingsDialog').showModal());
document.querySelector('#micBtn').addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { addMessage('Voice input is not supported in this browser. You can still type messages.', 'assistant'); return; }
  if (!recognition) {
    recognition = new SpeechRecognition(); recognition.lang = 'hi-IN'; recognition.interimResults = false;
    recognition.onresult = e => { input.value = e.results[0][0].transcript; };
    recognition.onerror = () => addMessage('Microphone recognition stopped. Please try typing instead.', 'assistant');
  }
  recognition.start();
});
speechToggle.addEventListener('change', () => { if (!speechToggle.checked) window.speechSynthesis?.cancel(); });
loadHistory();

// Lightweight procedural avatar placeholder. Replace with a licensed, optimized rigged GLB model later.
const mount = document.querySelector('#scene');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.1, 7.2);
const renderer = new THREE.WebGLRenderer({antialias:false, alpha:true, powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
mount.appendChild(renderer.domElement);
const avatar = new THREE.Group(); scene.add(avatar);
const skin = new THREE.MeshStandardMaterial({color:0xd6a58f, roughness:.78});
const hair = new THREE.MeshStandardMaterial({color:0x302331, roughness:.9});
const top = new THREE.MeshStandardMaterial({color:0x7888b8, roughness:.85});
const sphere = (r, material, x,y,z,sx=1,sy=1,sz=1) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r,20,16),material);
  mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); avatar.add(mesh); return mesh;
};
sphere(.72, top, 0,-1.15,0,1.12,.95,.65);
sphere(.48, skin, 0,.18,0,.82,1.08,.75);
sphere(.51, hair, 0,.48,-.12,.94,.92,.78);
sphere(.18, hair, -.42,.05,.02,.7,1.8,.7);
sphere(.18, hair, .42,.05,.02,.7,1.8,.7);
sphere(.055, new THREE.MeshStandardMaterial({color:0x2c1c20}), -.17,.2,.62,1,.65,.5);
sphere(.055, new THREE.MeshStandardMaterial({color:0x2c1c20}), .17,.2,.62,1,.65,.5);
sphere(.035, new THREE.MeshStandardMaterial({color:0x9b5f65}), 0,-.12,.63,1,.55,.4);
scene.add(new THREE.HemisphereLight(0xdce7ff,0x49374b,2.0));
const key = new THREE.DirectionalLight(0xffdfd0,2.1); key.position.set(-3,4,5); scene.add(key);
let frame = 0;
function animate() {
  requestAnimationFrame(animate); frame += .012;
  avatar.position.y = Math.sin(frame)*.035;
  avatar.rotation.y = Math.sin(frame*.45)*.055;
  renderer.render(scene,camera);
}
animate();
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.35)); renderer.setSize(innerWidth,innerHeight);
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
