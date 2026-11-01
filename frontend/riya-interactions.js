// Consent-gated, non-explicit interaction controls for RIYA.
// This module only triggers existing safe avatar poses, expressions and gestures.
export function mountRiyaInteractions() {
  if (document.getElementById('riyaInteractionPanel')) return;
  const panel = document.createElement('section');
  panel.id = 'riyaInteractionPanel';
  panel.setAttribute('aria-label', 'RIYA interaction controls');
  Object.assign(panel.style, {
    position: 'fixed', left: '14px', bottom: '14px', zIndex: '30',
    width: 'min(310px, calc(100vw - 28px))', maxHeight: 'min(66vh, 520px)',
    overflowY: 'auto', padding: '13px', borderRadius: '16px',
    background: 'rgba(20, 24, 34, .94)', color: '#fff',
    boxShadow: '0 8px 30px rgba(0,0,0,.28)', font: '13px/1.45 system-ui, sans-serif',
    backdropFilter: 'blur(12px)',
  });
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <strong style="font-size:15px">RIYA • Interactions</strong>
      <button type="button" data-close aria-label="Hide interactions" style="border:0;background:#343b4d;color:white;border-radius:8px;padding:5px 9px">Hide</button>
    </div>
    <p style="margin:7px 0 10px;color:#cbd5e1">Non-explicit affection, expressions and full-body poses.</p>
    <label style="display:flex;gap:8px;align-items:center;padding:9px;background:#30384a;border-radius:10px">
      <input type="checkbox" data-consent>
      <span>I consent to enable affectionate interactions</span>
    </label>
    <div data-controls aria-disabled="true" style="opacity:.45;pointer-events:none">
      <div style="margin:12px 0 5px;font-weight:700">Affection</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button data-pose="open_arms">Welcoming hug pose</button>
        <button data-gesture="kiss" data-mood="love">Blown kiss</button>
        <button data-gesture="heart" data-mood="happy">Heart gesture</button>
        <button data-pose="shy" data-mood="happy">Shy smile</button>
        <button data-pose="lean_in" data-mood="love">Lean closer</button>
      </div>
      <div style="margin:12px 0 5px;font-weight:700">Full-body poses</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button data-pose="natural">Natural</button>
        <button data-pose="wave">Wave</button>
        <button data-pose="thinking">Thinking</button>
        <button data-pose="cross_arms">Cross arms</button>
        <button data-pose="dance" data-body="idle">Dance</button>
        <button data-pose="playful">Playful</button>
        <button data-pose="nod">Nod</button>
      </div>
      <div style="margin:12px 0 5px;font-weight:700">Movement</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button data-body="idle">Stand</button>
        <button data-body="walk">Walk in place</button>
        <button data-body="sit">Sit</button>
      </div>
      <div style="margin:12px 0 5px;font-weight:700">Expression</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button data-mood="happy">Happy</button>
        <button data-mood="love">Love</button>
        <button data-mood="neutral">Neutral</button>
        <button data-mood="sad">Sad</button>
      </div>
    </div>
    <p data-status role="status" aria-live="polite" style="margin:10px 0 0;color:#cbd5e1">Enable consent to use these controls.</p>
  `;
  const style = document.createElement('style');
  style.textContent = `
    #riyaInteractionPanel button { border:1px solid #596276; background:#394357; color:#fff;
      border-radius:9px; padding:7px 9px; font:inherit; cursor:pointer; }
    #riyaInteractionPanel button:focus-visible, #riyaInteractionPanel input:focus-visible {
      outline:2px solid #93c5fd; outline-offset:2px; }
    @media (max-width:600px) { #riyaInteractionPanel { bottom:10px; left:10px; width:min(300px,calc(100vw - 20px)); } }
  `;
  document.head.appendChild(style);
  document.body.appendChild(panel);

  const consent = panel.querySelector('[data-consent]');
  const controls = panel.querySelector('[data-controls]');
  const status = panel.querySelector('[data-status]');
  const setEnabled = (enabled) => {
    controls.style.opacity = enabled ? '1' : '.45';
    controls.style.pointerEvents = enabled ? 'auto' : 'none';
    controls.setAttribute('aria-disabled', String(!enabled));
    status.textContent = enabled ? 'Consent enabled. Choose an interaction.' : 'Enable consent to use these controls.';
  };
  consent.addEventListener('change', () => setEnabled(consent.checked));
  panel.querySelector('[data-close]').addEventListener('click', () => panel.remove());
  panel.querySelectorAll('[data-pose], [data-body], [data-mood], [data-gesture]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!consent.checked) return;
      const action = {};
      for (const key of ['pose', 'body', 'mood', 'gesture']) {
        if (button.dataset[key]) action[key] = button.dataset[key];
      }
      if (typeof window.riyaApplyAction !== 'function') {
        status.textContent = 'Avatar is still loading. Try again in a moment.';
        return;
      }
      window.riyaApplyAction(action);
      status.textContent = 'Interaction sent to RIYA.';
    });
  });
  window.riyaInteractionsConsent = () => consent.checked;
}
