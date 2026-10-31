import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const API_BASE='https://riya-api-plnn.onrender.com';
const messagesEl=document.querySelector('#messages'),form=document.querySelector('#chatForm'),input=document.querySelector('#messageInput'),micButton=document.querySelector('#micBtn');
let recognition=null,avatarState='idle',speechTimer=null,voiceEnabled=true,cameraStream=null,attachments=[];
function addMessage(text,role){const node=document.createElement('div');node.className='bubble '+role;node.textContent=text;messagesEl.appendChild(node);messagesEl.scrollTop=messagesEl.scrollHeight}
function loadHistory(){try{JSON.parse(localStorage.getItem('riya-chat')||'[]').slice(-30).forEach(m=>addMessage(m.text,m.role))}catch{}}
function saveHistory(text,role){let items=[];try{items=JSON.parse(localStorage.getItem('riya-chat')||'[]')}catch{}items.push({text,role,at:Date.now()});try{localStorage.setItem('riya-chat',JSON.stringify(items.slice(-100)))}catch{}}
function setAvatarState(next){avatarState=next;const label=document.querySelector('#avatarState');if(label)label.textContent=next.toUpperCase()}
function speak(text){if(!voiceEnabled||!('speechSynthesis'in window))return;speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=/[\u0900-\u097F]/.test(text)?'hi-IN':'en-IN';utterance.rate=1;utterance.onstart=()=>setAvatarState('talking');utterance.onend=()=>setAvatarState('ready');speechSynthesis.speak(utterance)}
async function sendMessage(text){const clean=text.trim();if(!clean&&!attachments.length)return;let history=[];try{history=JSON.parse(localStorage.getItem('riya-chat')||'[]').slice(-11,-1).filter(x=>['user','assistant'].includes(x.role)).map(x=>({role:x.role,content:x.text.slice(0,2000)}))}catch{}
const attachmentNote=attachments.length?' [Attached locally: '+attachments.map(f=>f.name).join(', ')+']':'';const outgoing=clean+attachmentNote;addMessage(outgoing,'user');saveHistory(outgoing,'user');input.value='';attachments=[];renderAttachments();setAvatarState('thinking');
try{const response=await fetch(API_BASE+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:clean||'Please help with the attached file names: '+attachmentNote,history})});if(!response.ok)throw Error('API '+response.status);const data=await response.json();addMessage(data.reply,'assistant');saveHistory(data.reply,'assistant');speak(data.reply);if(!voiceEnabled)setAvatarState('ready');clearTimeout(speechTimer);speechTimer=setTimeout(()=>setAvatarState('ready'),Math.min(5000,Math.max(1400,data.reply.length*28)))}catch{const reply='I can’t reach the RIYA server right now. Please try again in a moment.';addMessage(reply,'assistant');saveHistory(reply,'assistant');speak(reply);setAvatarState('ready')}}
form.addEventListener('submit',e=>{e.preventDefault();sendMessage(input.value)});
const fileInput=document.querySelector('#fileInput'),attachBtn=document.querySelector('#attachBtn'),attachmentList=document.querySelector('#attachmentList');
attachBtn.addEventListener('click',()=>fileInput.click());fileInput.addEventListener('change',()=>{attachments.push(...Array.from(fileInput.files||[]));renderAttachments();fileInput.value=''});
function renderAttachments(){attachmentList.textContent=attachments.length?attachments.map(f=>f.name).join(' · ')+' (selected; upload support needs backend wiring)':''}
document.querySelector('#voiceToggle').addEventListener('click',e=>{voiceEnabled=!voiceEnabled;e.currentTarget.textContent=voiceEnabled?'🔊 Voice ON':'🔇 Voice OFF';e.currentTarget.setAttribute('aria-pressed',String(voiceEnabled));if(!voiceEnabled&&'speechSynthesis'in window)speechSynthesis.cancel()});
micButton.addEventListener('click',()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){addMessage('Voice input is not supported in this browser. You can type instead.','assistant');return}if(!recognition){recognition=new SR();recognition.lang='hi-IN';recognition.interimResults=false;recognition.onresult=e=>{input.value=e.results[0][0].transcript};recognition.onerror=()=>{setAvatarState('ready');addMessage('Microphone recognition stopped.','assistant')};recognition.onend=()=>setAvatarState('ready')}try{recognition.start();setAvatarState('listening')}catch{setAvatarState('ready')}});
const video=document.querySelector('#cameraPreview'),cameraToggle=document.querySelector('#cameraToggle'),cameraStop=document.querySelector('#cameraStop'),cameraNotice=document.querySelector('#cameraNotice'),qualitySelect=document.querySelector('#qualitySelect');
const sizes={144:[256,144],240:[426,240],360:[640,360],480:[854,480],720:[1280,720]};
async function startCamera(){if(!navigator.mediaDevices?.getUserMedia){cameraNotice.textContent='Camera access requires a supported browser and secure HTTPS connection.';return}cameraToggle.disabled=true;try{const [width,height]=sizes[qualitySelect.value];cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:width},height:{ideal:height}}});video.srcObject=cameraStream;video.classList.add('active');await video.play();cameraToggle.textContent='Camera ON';cameraStop.disabled=false;cameraNotice.textContent='Camera preview is on · visible on this device only';setAvatarState('camera on')}catch(err){cameraNotice.textContent=err.name==='NotAllowedError'?'Camera permission was not granted. You can enable it in browser settings.':'Could not start camera: '+err.message}finally{cameraToggle.disabled=false}}
function stopCamera(){if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;video.srcObject=null;video.classList.remove('active');cameraToggle.textContent='Start camera';cameraStop.disabled=true;cameraNotice.textContent='Camera is off · Tap “Start camera” to enable a visible local preview';setAvatarState('ready')}
cameraToggle.addEventListener('click',startCamera);cameraStop.addEventListener('click',stopCamera);qualitySelect.addEventListener('change',()=>{if(cameraStream){stopCamera();startCamera()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&cameraStream){stopCamera()}});
loadHistory();
// Full-screen RIYA portrait fallback when camera is off.
const mount=document.querySelector('#scene'),scene=new THREE.Scene();scene.background=new THREE.Color(0x111827);
const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,100);camera.position.set(0,-.72,9.2);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;mount.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcbdcff,0x30202b,1.8));const light=new THREE.DirectionalLight(0xffdfd0,2.2);light.position.set(-3,4,5);scene.add(light);
const avatar=new THREE.Group();scene.add(avatar);
const mat=(color,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness});
const skinDetail=new THREE.MeshPhysicalMaterial({color:0xf1c6a8,roughness:.58,clearcoat:.12,clearcoatRoughness:.7});
const eyeWhite=new THREE.MeshStandardMaterial({color:0xfffaf5,roughness:.28});
const irisDetail=new THREE.MeshPhysicalMaterial({color:0x49302b,roughness:.22,clearcoat:.7});
const lipDetail=new THREE.MeshPhysicalMaterial({color:0x99505e,roughness:.38,clearcoat:.18});
const skin=mat(0xf1c6a8),hair=mat(0x211a2b),hairLight=mat(0x38263a),shirt=mat(0x9b5b86),white=mat(0xfff8f2),iris=mat(0x49302b),dark=mat(0x241a20),lip=mat(0xb85d70);
function ball(parent,x,y,z,sx,sy,sz,material){const m=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
const body=new THREE.Group();avatar.add(body);
ball(body,0,-1.72,-.05,1.02,.82,.48,shirt);
 // Full-body casual RIYA character: modest outfit, articulated-looking limbs and shoes.
 const pants=mat(0x3b405b),shoe=mat(0xf5e9e7),sleeve=mat(0x875078);
 function limb(parent,a,b,r1,r2,material){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,delta.length(),24),material);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(mesh);ball(parent,...a,r1,r1,r1,material);ball(parent,...b,r2,r2,r2,material);return mesh}
 // Long trousers and legs
 ball(body,-.38,-2.55,-.02,.38,.95,.36,pants);ball(body,.38,-2.55,-.02,.38,.95,.36,pants);
 limb(body,[-.38,-2.95,0],[-.40,-3.55,.02],.23,.19,pants);
 limb(body,[.38,-2.95,0],[.40,-3.55,.02],.23,.19,pants);
 ball(body,-.41,-3.66,.13,.29,.13,.43,shoe);ball(body,.41,-3.66,.13,.29,.13,.43,shoe);
 // Sleeves and arms resting naturally beside the torso
 limb(body,[-.82,-1.35,0],[-1.02,-2.05,.05],.23,.17,sleeve);
 limb(body,[.82,-1.35,0],[1.02,-2.05,.05],.23,.17,sleeve);
 limb(body,[-1.02,-2.05,.05],[-.94,-2.45,.16],.17,.14,skinDetail);
 limb(body,[1.02,-2.05,.05],[.94,-2.45,.16],.17,.14,skinDetail);
 // Simple collar detail
 const collar=ball(body,0,-1.28,.43,.35,.18,.08,white);
 collar.rotation.z=Math.PI;

ball(body,0,-.96,0,.28,.55,.28,skin);
const head=new THREE.Group();head.position.set(0,.62,0);avatar.add(head);
ball(head,0,0,0,.76,.98,.66,skinDetail);
ball(head,0,.72,-.02,.84,.53,.7,hair);
ball(head,-.72,.12,-.02,.19,.72,.55,hair);
ball(head,.72,.12,-.02,.19,.72,.55,hair);
const fringe=ball(head,0,.57,.47,.72,.3,.22,hairLight);fringe.rotation.z=-.08;
for(const x of [-.30,.30]){
 const socket=ball(head,x,.18,.575,.225,.155,.095,mat(0xd8a995));
 const eye=ball(head,x,.19,.635,.185,.105,.075,eyeWhite);
 const irisMesh=ball(head,x,.185,.697,.073,.083,.028,irisDetail);
 ball(head,x,.185,.718,.033,.048,.015,dark);
 ball(head,x-.022,.218,.735,.018,.018,.009,white);
 const upperLid=ball(head,x,.285,.64,.19,.038,.07,skinDetail);upperLid.rotation.z=x<0?.04:-.04;
 const brow=ball(head,x,.405,.59,.22,.035,.05,hair);brow.rotation.z=x<0?-.10:.10;
}
// Subtle nose bridge and tip give the face more natural depth.
const noseBridge=ball(head,0,.015,.655,.055,.17,.075,skinDetail);noseBridge.rotation.x=-.12;
ball(head,0,-.105,.705,.085,.065,.075,skinDetail);
ball(head,-.052,-.13,.69,.026,.018,.018,mat(0xb67f70));ball(head,.052,-.13,.69,.026,.018,.018,mat(0xb67f70));
const mouth=ball(head,0,-.405,.64,.17,.025,.035,lipDetail);
const lowerLip=ball(head,0,-.445,.645,.13,.022,.03,lipDetail);
ball(head,-.84,-.1,.02,.13,.2,.12,skin);ball(head,.84,-.1,.02,.13,.2,.12,skin);
const hairBack=ball(head,0,-.2,-.39,.84,.9,.3,hair);hairBack.position.z=-.39;
const eyes=head.children.filter((node)=>node.geometry?.type==='SphereGeometry' && node.position.y===.19 && node.position.z===.635);

let frame=0;const clock=new THREE.Clock();let talkPulse=0;function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);frame+=dt;const talking=avatarState==='talking';const target=talking?1:0;talkPulse+=(target-talkPulse)*Math.min(1,dt*(talking?10:3));const beat=talking?Math.abs(Math.sin(frame*11)):0;mouth.scale.y=.045+talkPulse*(.13+beat*.18);lowerLip.position.y=-.48-talkPulse*(.025+beat*.025);head.rotation.y=Math.sin(frame*.7)*.045;head.rotation.z=Math.sin(frame*1.1)*.012;head.position.y=.62+Math.sin(frame*1.8)*.025;avatar.position.y=-.12+Math.sin(frame*1.8)*.035;avatar.rotation.y=Math.sin(frame*.35)*.025;const blink=Math.pow(Math.max(0,Math.sin(frame*.7-1.1)),36);for(const eye of eyes)eye.scale.y=.105*(1-blink*.88);renderer.render(scene,camera);const fallback=document.querySelector('#avatarFallback');if(fallback)fallback.classList.add('hidden')}animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight)});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
