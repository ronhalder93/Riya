import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const API_BASE = 'https://riya-api-plnn.onrender.com';
// Add a licensed rigged GLB/GLTF URL here when the final realistic avatar asset is ready.
const AVATAR_MODEL_URL = '';
const messagesEl = document.querySelector('#messages');
const form = document.querySelector('#chatForm');
const input = document.querySelector('#messageInput');
const micButton = document.querySelector('#micBtn');
let recognition = null;
let avatarState = 'idle';
let speechTimer = null;

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
  } catch {}
}
function saveHistory(text, role) {
  let items = [];
  try { items = JSON.parse(localStorage.getItem('riya-chat') || '[]'); } catch {}
  items.push({text, role, at: Date.now()});
  localStorage.setItem('riya-chat', JSON.stringify(items.slice(-100)));
}
function setAvatarState(next) {
  avatarState = next;
  const label = document.querySelector('#avatarState');
  if (label) {
    label.textContent = next === 'listening' ? 'LISTENING' : next === 'thinking' ? 'THINKING' : next === 'talking' ? 'TALKING' : 'HERE WITH YOU';
    label.dataset.state = next;
  }
}
async function sendMessage(text) {
  const clean = text.trim();
  if (!clean) return;
  let history = [];
  try {
    const saved = JSON.parse(localStorage.getItem('riya-chat') || '[]');
    history = saved.slice(-11, -1)
      .filter(item => ['user', 'assistant'].includes(item.role) && typeof item.text === 'string')
      .map(item => ({role: item.role, content: item.text.slice(0, 2000)}));
  } catch {}
  addMessage(clean, 'user'); saveHistory(clean, 'user'); input.value = '';
  setAvatarState('thinking');
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({message: clean, history})
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    addMessage(data.reply, 'assistant'); saveHistory(data.reply, 'assistant');
    setAvatarState('talking');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => setAvatarState('idle'), Math.min(5000, Math.max(1400, data.reply.length * 28)));
  } catch {
    const reply = 'I can’t reach the RIYA server right now. Check that the backend is running and the API URL is configured.';
    addMessage(reply, 'assistant'); saveHistory(reply, 'assistant');
    setAvatarState('idle');
  }
}
form.addEventListener('submit', e => { e.preventDefault(); sendMessage(input.value); });

micButton.addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addMessage('Voice input is not supported in this browser. You can still type messages.', 'assistant');
    return;
  }
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.onresult = e => { input.value = e.results[0][0].transcript; };
    recognition.onerror = () => { setAvatarState('idle'); addMessage('Microphone recognition stopped. Please try typing instead.', 'assistant'); };
    recognition.onend = () => setAvatarState('idle');
  }
  try { recognition.start(); setAvatarState('listening'); }
  catch { setAvatarState('idle'); }
});
loadHistory();

// RIYA portrait stage. Place the generated portrait at frontend/assets/riya.png.
const mount = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090d18);
scene.fog = new THREE.Fog(0x090d18, 8, 18);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.05, 7.8);
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
mount.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcbdcff, 0x30202b, 1.8));
const keyLight = new THREE.DirectionalLight(0xffdfd0, 2.2);
keyLight.position.set(-3, 4, 5); scene.add(keyLight);

const avatar = new THREE.Group();
scene.add(avatar);
let portraitMesh = null;
let portraitReady = false;
new THREE.TextureLoader().load('./assets/riya.png', texture => {
  texture.colorSpace = THREE.SRGBColorSpace;
  const aspect = texture.image.width / texture.image.height;
  const height = 5.2;
  const material = new THREE.MeshBasicMaterial({map:texture, transparent:false});
  portraitMesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), material);
  portraitMesh.position.set(0, -0.2, 0);
  avatar.add(portraitMesh);
  portraitReady = true;
}, undefined, () => console.warn('Add the generated portrait at frontend/assets/riya.png to show RIYA.'));

let frame=0;
const clock=new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt=clock.getDelta(); frame+=dt;
  avatar.position.y=Math.sin(frame*1.15)*.025;
  avatar.rotation.y=Math.sin(frame*.32)*.018;
  if (portraitMesh) {
    const talking = avatarState === 'talking';
    portraitMesh.scale.y = 1 + (talking ? Math.abs(Math.sin(frame*8))*.006 : 0);
  }
  renderer.render(scene,camera);
}
animate();
addEventListener('resize', () => {
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setSize(innerWidth,innerHeight);
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}