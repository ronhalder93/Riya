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

// 3D character stage. A licensed rigged model can replace the procedural preview via AVATAR_MODEL_URL.
const mount = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090d18);
scene.fog = new THREE.Fog(0x090d18, 8, 18);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.15, 7.8);
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
mount.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcbdcff, 0x30202b, 2.0));
const keyLight = new THREE.DirectionalLight(0xffdfd0, 3.0);
keyLight.position.set(-3, 4, 5); scene.add(keyLight);
const fillLight = new THREE.PointLight(0x829bff, 18, 12);
fillLight.position.set(3, 1, 3); scene.add(fillLight);
const rimLight = new THREE.PointLight(0xc28cff, 22, 10);
rimLight.position.set(0, 2, -3); scene.add(rimLight);

const avatar = new THREE.Group();
scene.add(avatar);
const skin = new THREE.MeshStandardMaterial({color:0xc98f78, roughness:.68});
const hair = new THREE.MeshStandardMaterial({color:0x211923, roughness:.82});
const shirt = new THREE.MeshStandardMaterial({color:0x343d59, roughness:.82});
const dark = new THREE.MeshStandardMaterial({color:0x241b20, roughness:.5});
const eyeWhite = new THREE.MeshStandardMaterial({color:0xf2e9e4, roughness:.4});
const lip = new THREE.MeshStandardMaterial({color:0x985a62, roughness:.55});
const sphere = (parent, r, material, x,y,z,sx=1,sy=1,sz=1, w=32,h=24) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r,w,h),material);
  mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); parent.add(mesh); return mesh;
};

// Bust and neck
sphere(avatar,.88,shirt,0,-1.38,-.12,1.25,.95,.72,40,28);
sphere(avatar,.25,skin,0,-.52,0,.78,1.1,.8);
const head = new THREE.Group(); avatar.add(head); head.position.y=.18;
sphere(head,.57,skin,0,0,0,.86,1.12,.78,48,36);
// Hair cap and side locks
sphere(head,.59,hair,0,.34,-.12,.98,.72,.88,48,32);
sphere(head,.19,hair,-.47,-.02,.02,.78,1.55,.78);
sphere(head,.19,hair,.47,-.02,.02,.78,1.55,.78);
const fringe = sphere(head,.25,hair,-.17,.39,.42,1.2,.72,.42);
fringe.rotation.z=-.25;
sphere(head,.16,hair,.12,.43,.42,1.15,.62,.4).rotation.z=.18;
// Ears and facial features
sphere(head,.09,skin,-.49,-.08,0,.7,1.2,.65);
sphere(head,.09,skin,.49,-.08,0,.7,1.2,.65);
sphere(head,.065,eyeWhite,-.17,.04,.635,1,.78,.35);
sphere(head,.065,eyeWhite,.17,.04,.635,1,.78,.35);
const leftEye=sphere(head,.031,dark,-.17,.035,.663,1,1,.55);
const rightEye=sphere(head,.031,dark,.17,.035,.663,1,1,.55);
sphere(head,.014,eyeWhite,-.18,.05,.68,1,1,.5);
sphere(head,.014,eyeWhite,.16,.05,.68,1,1,.5);
const nose=sphere(head,.045,skin,0,-.09,.67,.72,1.1,.65);
const mouth=sphere(head,.052,lip,0,-.25,.64,.9,.22,.35);
mouth.scale.y=.16;
const browsMat=new THREE.MeshStandardMaterial({color:0x392630,roughness:.8});
const browL=sphere(head,.075,browsMat,-.17,.16,.61,1.5,.25,.3);
const browR=sphere(head,.075,browsMat,.17,.16,.61,1.5,.25,.3);
browL.rotation.z=.08; browR.rotation.z=-.08;

if (AVATAR_MODEL_URL) {
  new GLTFLoader().load(AVATAR_MODEL_URL, gltf => {
    avatar.remove(head);
    avatar.remove(avatar.children.find(child => child !== head));
    avatar.add(gltf.scene);
  }, undefined, error => console.warn('RIYA avatar model could not be loaded:', error));
}

let frame=0, blink=0, nextBlink=2.5;
function animate() {
  requestAnimationFrame(animate);
  const dt=clock.getDelta(); frame+=dt;
  avatar.position.y=Math.sin(frame*1.15)*.035;
  avatar.rotation.y=Math.sin(frame*.32)*.045;
  head.rotation.y=Math.sin(frame*.48)*.025;
  head.rotation.x=Math.sin(frame*.7)*.012;
  if (frame > nextBlink) { blink=.16; nextBlink=frame+2.2+Math.random()*3.2; }
  blink=Math.max(0,blink-dt*2.8);
  const eyeScale=Math.max(.08,1-blink*5.5);
  // Subtle eyelid-like blink on both eyes.
  leftEye.scale.y=.031*eyeScale; rightEye.scale.y=.031*eyeScale;
  const speaking=avatarState==='talking';
  mouth.scale.y=speaking ? .16+Math.abs(Math.sin(frame*13))*.42 : .16;
  mouth.scale.x=avatarState==='listening' ? 1.08 : .9;
  if (avatarState==='listening') head.rotation.x=-.035+Math.sin(frame*2)*.012;
  renderer.render(scene,camera);
}
const clock=new THREE.Clock();
animate();
addEventListener('resize', () => {
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setSize(innerWidth,innerHeight);
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
