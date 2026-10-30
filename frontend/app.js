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
const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,100);camera.position.set(0,.05,7.8);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;mount.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcbdcff,0x30202b,1.8));const light=new THREE.DirectionalLight(0xffdfd0,2.2);light.position.set(-3,4,5);scene.add(light);
const avatar=new THREE.Group();scene.add(avatar);
const mat=(color,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness});
const skin=mat(0xf1c6a8),hair=mat(0x211a2b),hairLight=mat(0x38263a),shirt=mat(0x9b5b86),white=mat(0xfff8f2),iris=mat(0x49302b),dark=mat(0x241a20),lip=mat(0xb85d70);
function ball(parent,x,y,z,sx,sy,sz,material){const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
const body=new THREE.Group();avatar.add(body);
ball(body,0,-1.72,-.05,1.02,.82,.48,shirt);
ball(body,0,-.96,0,.28,.55,.28,skin);
const head=new THREE.Group();head.position.set(0,.62,0);avatar.add(head);
ball(head,0,0,0,.82,1.02,.68,skin);
ball(head,0,.72,-.02,.84,.53,.7,hair);
ball(head,-.72,.12,-.02,.19,.72,.55,hair);
ball(head,.72,.12,-.02,.19,.72,.55,hair);
const fringe=ball(head,0,.57,.47,.72,.3,.22,hairLight);fringe.rotation.z=-.08;
for(const x of [-.31,.31]){
 ball(head,x,.18,.59,.205,.14,.07,white);
 ball(head,x,.18,.655,.085,.095,.045,iris);
 ball(head,x,.18,.69,.04,.055,.025,dark);
 const brow=ball(head,x,.43,.59,.23,.045,.055,hair);brow.rotation.z=x<0?-.12:.12;
}
ball(head,0,-.02,.68,.09,.2,.09,mat(0xd99e84));
const mouth=ball(head,0,-.43,.625,.22,.045,.055,dark);
const lowerLip=ball(head,0,-.48,.63,.16,.025,.035,lip);
ball(head,-.84,-.1,.02,.13,.2,.12,skin);ball(head,.84,-.1,.02,.13,.2,.12,skin);
const hairBack=ball(head,0,-.2,-.39,.84,.9,.3,hair);hairBack.position.z=-.39;
const eyes=[head.children[5],head.children[8]];

let frame=0;const clock=new THREE.Clock();let talkPulse=0;function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);frame+=dt;const talking=avatarState==='talking';const target=talking?1:0;talkPulse+=(target-talkPulse)*Math.min(1,dt*(talking?10:3));const beat=talking?Math.abs(Math.sin(frame*11)):0;mouth.scale.y=.045+talkPulse*(.13+beat*.18);lowerLip.position.y=-.48-talkPulse*(.025+beat*.025);head.rotation.y=Math.sin(frame*.7)*.045;head.rotation.z=Math.sin(frame*1.1)*.012;head.position.y=.62+Math.sin(frame*1.8)*.025;avatar.position.y=-.12+Math.sin(frame*1.8)*.035;avatar.rotation.y=Math.sin(frame*.35)*.025;const blink=Math.pow(Math.max(0,Math.sin(frame*.7-1.1)),36);for(const eye of eyes)eye.scale.y=.14*(1-blink*.88);renderer.render(scene,camera)}animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight)});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
