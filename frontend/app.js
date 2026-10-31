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
// Use the actual generated RIYA reference image from the repository.
const mount=document.querySelector('#scene');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x151821);
const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,8);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
mount.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x303040,1.4));
const keyLight=new THREE.DirectionalLight(0xffffff,1.1);keyLight.position.set(-2,3,5);scene.add(keyLight);
const portraitGroup=new THREE.Group();scene.add(portraitGroup);
const loader=new THREE.TextureLoader();
loader.load('./result.jpg',texture=>{
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:false});
  const portrait=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  portrait.userData.imageAspect=texture.image.width/texture.image.height;
  portraitGroup.add(portrait);
  function fitPortrait(){
    const h=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.z;
    const w=h*camera.aspect, imageAspect=portrait.userData.imageAspect;
    let pw=w,ph=w/imageAspect;
    if(ph>h){ph=h;pw=h*imageAspect}
    portrait.scale.set(pw,ph,1);
  }
  fitPortrait();
  addEventListener('resize',fitPortrait);
},undefined,()=>{const fallback=document.querySelector('#avatarFallback');if(fallback)fallback.classList.remove('hidden')});
let frame=0;
function animate(){requestAnimationFrame(animate);frame+=.016;portraitGroup.position.y=Math.sin(frame*.7)*.008;portraitGroup.rotation.y=Math.sin(frame*.35)*.012;renderer.render(scene,camera)}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight)});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
