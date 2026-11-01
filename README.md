# RIYA

RIYA is an Android-first, installable PWA starter for a friendly AI virtual companion.

> Current milestone: Phase 2 foundation. The current brunette GLB is a demo character. A photorealistic RIYA character still requires a separately licensed/customized adult character asset and compatibility testing.

## Stack

- Frontend: HTML, CSS, JavaScript, Three.js
- Backend: Python + FastAPI
- AI: OpenAI Responses API (server-side; optional until a key is configured)
- Local chat history: browser localStorage (starter implementation)
- PWA: manifest + service worker
- Hosting: Render

## Project layout

```text
riya/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── providers.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/
├── render.yaml
├── .env.example
└── README.md
```

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
source .venv/bin/activate
pip install -r requirements.txt
```

Set `OPENAI_API_KEY` in your local shell (never in source code), then run:

```bash
export RIYA_AI_PROVIDER=openai
export OPENAI_MODEL=gpt-6-luna
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On Windows PowerShell use `$env:OPENAI_API_KEY="your-key"` and `$env:RIYA_AI_PROVIDER="openai"`.

### Frontend

Serve `frontend/` from a local static server (for example `python -m http.server 5500` from that directory). Set the API base in `frontend/app.js` to `http://localhost:8000`.

For microphone features, use HTTPS or localhost. Browser speech recognition support varies by browser and device; text chat remains available when voice APIs are missing.

## Deploying on Render

For the backend service, add these in Render's Environment settings:
- `RIYA_AI_PROVIDER` = `openai`
- `OPENAI_MODEL` = `gpt-6-luna`
- `OPENAI_API_KEY` = your secret API key (mark as secret if the dashboard offers that option)

Save changes to trigger a redeploy. If the key is absent, RIYA safely remains in demo mode. Never add a real key to GitHub, frontend JavaScript, screenshots, or chat messages. Rotate the key immediately if it is exposed.

API usage may incur charges. Have a parent/guardian manage the API account, billing, and secret key if you are under 18. Set a low usage budget/limit in the API account and monitor usage.

## AI provider safety and security

- The browser never receives the provider API key; requests go through the FastAPI backend.
- Uses the OpenAI Responses API with a short validated history window, request timeout, limited output, and `store=False`.
- The backend never logs prompts, credentials, or raw provider errors.
- Do not promise unlimited free inference.
- This starter has no user authentication; do not expose the API publicly without adding abuse protection and per-user rate limits.

## Character and companion boundaries

RIYA is a fictional, friendly, supportive AI assistant. It should not present itself as a real person or romantic partner or encourage emotional dependency. Provide clear controls to pause voice, clear local history, and reset preferences.

## Roadmap

1. Phase 1: mobile HUD, procedural avatar placeholder, PWA shell, backend health/chat endpoints.
2. Phase 2: secure OpenAI Responses API adapter (implemented; requires server-side key).
3. Phase 3: speech input/output and basic mouth animation.
4. Phase 4: user-controlled memory and export/delete controls.
5. Phase 5: licensed rigged character, facial blendshapes, and optimized animations.
6. Phase 6: optional image studio with provider limits and age-appropriate output controls.
7. Phase 7: Android 10/device testing and performance profiling.
8. Phase 8: Render deployment and live verification.
9. Phase 9: optional Android wrapper and signed APK build.

## Photorealistic avatar integration

The avatar loader accepts an optional custom GLB URL before `frontend/avatar.js` loads:

```html
<script>
  window.RIYA_AVATAR_URL = './assets/riya-photoreal.glb';
</script>
<script type="module" src="./avatar.js"></script>
```

If the configured character fails to load in TalkingHead, RIYA automatically falls back to the current demo avatar instead of leaving the scene blank. Do not point this setting at an arbitrary GLB and assume it is compatible: validate its skeleton, skin weights, facial morph targets, materials, and animation behavior first. The current procedural body poses depend on Mixamo-style bone names and may need retargeting for a new rig.

A suitable production asset should be an adult photorealistic digital human with PBR skin/hair textures, a compatible humanoid skeleton, facial blendshapes for expressions/lip sync, and separate skinned clothing meshes if outfit switching is required.

For compatible GLB files that include authored body morph targets, the runtime exposes optional shape controls. Configure them before `avatar.js` loads:

```html
<script>
  window.RIYA_BODY_SHAPE = { breastFullness: 0.7 };
</script>
```

Or adjust the loaded avatar from the browser console with `window.riyaSetBodyShape({ breastFullness: 0.7 })`. Values are clamped to 0–1. The runtime looks for morph-target names containing breast/bust/chest (and waist/hip for those controls); it does not deform the mesh or invent missing morph targets. Check `window.riyaBodyShapeStatus()` to see which morph targets the loaded model actually provides. A visible change requires a GLB whose creator has authored suitable body-shape morphs and fitted the clothing to them. The free CC0 Woman Base Mesh at https://grab3d.com/models/characters/woman-base-character/ is one possible starting point (its page advertises a rigged GLB and walk/run clips), but it is a neutral base mesh, not a finished Indian-looking RIYA character; it must be inspected, customized, and tested before replacing the live model.

## Current limitations

- OpenAI replies require a valid API key and API billing/usage allowance.
- The avatar is procedural and not a photorealistic custom model.
- Browser speech APIs are not consistently available across Android browsers.
- No APK is included.

## RIYA realtime voice agent

The LiveKit voice agent lives in `backend/agent.py`. It uses LiveKit Inference for multilingual speech-to-text, the language model, and text-to-speech, so no separate speech-provider API keys are required. LiveKit Inference usage is subject to the project's included quota and current pricing.

### Deploy the agent to LiveKit Cloud

From a terminal on a computer with the LiveKit CLI installed:

```bash
cd backend
lk cloud auth
lk agent create
```

Choose the RIYA LiveKit project when prompted. The deployed agent dispatch name is `riya-agent`; the FastAPI token endpoint requests this agent when a new call room is created.

Keep `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` configured as secrets in Render for the API service. Do not commit credentials or paste them into chat. The LiveKit agent deployment also needs the same three values configured as deployment secrets if the CLI prompts for them.

After deployment, open the RIYA website and start a new call. The agent should join the newly created room and greet the participant. Existing text chat remains available independently.


## Create the custom RIYA character

The **Create RIYA model** button opens the open-source CharacterCreator in a new tab with a female body and long-hair preset. In its studio:

1. Keep the character clearly adult; set the body sex to female and choose the long hairstyle.
2. In the Chest controls, adjust size, firmness, height, spacing and projection to the requested naturally fuller-bust proportions.
3. Choose a dark-and-light clothing combination (for example a dark top with a light skirt). A maid apron is not included as a ready-made garment in the upstream catalog and would need a separate fitted garment.
4. Use the studio's Export section to export a GLB.

The upstream generator is documented at https://github.com/kblood/CharacterCreator and its generated MakeHuman assets are CC0. Its generator source is GPL-3.0-or-later. Keep the upstream license notices with any copied generator code.

**Integration caveat:** the exported model uses the generator's MPFB 53-bone rig, while RIYA's current TalkingHead procedural body poses expect Mixamo-style bone names. Do not overwrite the live avatar automatically. First load the exported GLB with **Load 3D avatar** and check whether TalkingHead accepts its skeleton and face morphs. If it does not, the model needs a rig/viseme retargeting step before it can replace the demo avatar or use full-body gestures. The **Load 3D avatar** button imports a GLB and stores it in this browser's IndexedDB on this device, so it is restored after refresh. The file is not uploaded to RIYA's server or committed to GitHub. Use **Use demo avatar** to remove the locally saved model and return to the bundled demo.
