# RIYA

RIYA is an Android-first, installable PWA starter for a friendly AI virtual companion.

> Current milestone: Phase 1 foundation. This repository is a working scaffold, not a completed product. The 3D avatar is a lightweight procedural placeholder and must be replaced by a properly licensed, rigged GLB character for production.

## Stack

- Frontend: HTML, CSS, JavaScript, Three.js
- Backend: Python + FastAPI
- Local chat history: browser localStorage (starter implementation)
- PWA: manifest + service worker
- Hosting target: Render

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
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

Serve `frontend/` from a local static server (for example `python -m http.server 5500` from that directory). Set the API base in `frontend/app.js` to `http://localhost:8000`.

For microphone features, use HTTPS or localhost. Browser speech recognition support varies by browser and device; text chat remains available when voice APIs are missing.

## Deploying on Render

The included `render.yaml` defines a free-instance web service. Set environment variables in Render before enabling a real AI provider. Free instance availability and sleep behavior are controlled by Render and may change.

## AI provider safety and security

- Never put provider API keys in frontend code.
- Add provider credentials as backend environment variables.
- The starter backend intentionally returns a local fallback response until a provider adapter is configured.
- Add provider-specific rate limits, timeouts, retries, and usage caps before public deployment.
- Do not promise unlimited free inference.

## Character and companion boundaries

RIYA is designed as a fictional, friendly, supportive character. Avoid presenting it as a real person or encouraging emotional dependency. Provide clear controls to pause voice, clear local history, and reset preferences.

## Roadmap

1. Phase 1: mobile HUD, procedural avatar placeholder, PWA shell, backend health/chat endpoints.
2. Phase 2: secure AI provider adapter and conversation context.
3. Phase 3: speech input/output and basic mouth animation.
4. Phase 4: user-controlled memory and export/delete controls.
5. Phase 5: licensed rigged character, facial blendshapes, and optimized animations.
6. Phase 6: optional image studio with provider limits and age-appropriate output controls.
7. Phase 7: Android 10/device testing and performance profiling.
8. Phase 8: Render deployment and live verification.
9. Phase 9: optional Android wrapper and signed APK build.

## Current limitations

- The avatar is procedural and not a photorealistic custom model.
- Browser speech APIs are not consistently available across Android browsers.
- The chat endpoint is a safe local fallback, not connected to an external AI provider.
- No APK is included.
