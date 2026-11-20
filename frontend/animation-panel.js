const panel = document.createElement('section');
panel.id = 'riyaAnimationPanel';
panel.setAttribute('aria-label', 'RIYA animation and quality controls');
panel.innerHTML = `
  <button type="button" id="riyaPanelToggle" aria-expanded="false">✨ Character</button>
  <div id="riyaPanelBody" hidden>
    <div class="riya-panel-heading">RENDER QUALITY</div>
    <div class="riya-quality-row" role="group" aria-label="Render quality">
      <button type="button" data-quality="normal" aria-pressed="true">Normal</button>
      <button type="button" data-quality="premium" aria-pressed="false">Premium</button>
      <button type="button" data-quality="ultra" aria-pressed="false">Ultra</button>
    </div>
    <div class="riya-panel-heading">ANIMATIONS</div>
    <div class="riya-animation-grid">
      <button type="button" data-animation="idle">Idle</button>
      <button type="button" data-animation="walk">Walk</button>
      <button type="button" data-animation="run">Run</button>
      <button type="button" data-animation="dance">Dance</button>
      <button type="button" data-animation="sit">Sit</button>
    </div>
    <p id="riyaAnimationStatus" role="status">Waiting for character…</p>
    <a href="https://huggingface.co/datasets/Kinemiq/free-game-animations/resolve/main/KinemIQ_Free_Animations_CC0_GLB.zip" target="_blank" rel="noopener">Get free CC0 animation pack (GLB)</a>
  </div>`;
document.body.appendChild(panel);

const toggle = panel.querySelector('#riyaPanelToggle');
const body = panel.querySelector('#riyaPanelBody');
const status = panel.querySelector('#riyaAnimationStatus');
toggle.addEventListener('click', () => {
  const open = body.hidden;
  body.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
});

const qualitySettings = {
  normal: { pixelRatio: 1, shadows: false },
  premium: { pixelRatio: 1.5, shadows: true },
  ultra: { pixelRatio: 2, shadows: true },
};
function applyQuality(level) {
  const config = qualitySettings[level] || qualitySettings.normal;
  const renderer = window.riyaHead?.renderer;
  if (renderer?.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.pixelRatio));
  if (renderer?.shadowMap) renderer.shadowMap.enabled = config.shadows;
  panel.querySelectorAll('[data-quality]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.quality === level));
  });
  try { localStorage.setItem('riya-render-quality', level); } catch {}
  status.textContent = level[0].toUpperCase() + level.slice(1) + ' quality selected';
}
panel.querySelectorAll('[data-quality]').forEach((button) => {
  button.addEventListener('click', () => applyQuality(button.dataset.quality));
});
panel.querySelectorAll('[data-animation]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.animation;
    const ok = window.riyaPremiumAction?.(action);
    if (ok) status.textContent = action[0].toUpperCase() + action.slice(1) + ' animation started';
    else status.textContent = action + ' is not included in the currently loaded character model yet';
  });
});
let savedQuality = 'normal';
try {
  const stored = localStorage.getItem('riya-render-quality');
  if (qualitySettings[stored]) savedQuality = stored;
} catch {}
applyQuality(savedQuality);
window.addEventListener('riya-character-ready', () => {
  applyQuality(savedQuality);
  const available = window.riyaPremiumAnimationStatus?.().available || [];
  status.textContent = 'Available now: ' + available.join(', ');
});
