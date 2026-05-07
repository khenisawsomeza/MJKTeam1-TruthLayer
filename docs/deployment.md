# TruthLayer Free Deployment Guide

This guide prepares the project for this hosted demo architecture:

```text
Chrome Extension -> Online Backend API -> Online AI Service
```

Judges only load the unpacked Chrome extension. They do not install Docker.

## Recommended Free Setup

Use this setup for a capstone or thesis demo:

| Layer | Host | Why |
| --- | --- | --- |
| Chrome extension | Loaded unpacked in Chrome | No store review and fastest judging setup |
| Backend Node API | Render Free Web Service | Simple GitHub deploy, environment variables, stable HTTPS URL |
| FastAPI ML service | Hugging Face Spaces CPU Basic with Docker SDK | Free ML-friendly CPU, enough RAM for scikit-learn, simple secrets |

Why not Railway as the default: Railway is polished, but its current free path is a trial/credit model, not the best long-lived free demo setup.

Why not Fly.io as the default: Fly is excellent for containers, but it is now pay-as-you-go for new users rather than the clearest free judging option.

Why not Render for both services: Render can host both, but the free web service sleep behavior can add two cold starts. Hugging Face gives the ML service more free memory headroom for scikit-learn and model files.

## Current Deployment Knobs

Backend:

```text
PORT
AI_SERVICE_URL
AI_SERVICE_TIMEOUT_MS
CORS_ORIGIN
```

AI service:

```text
PORT
CORS_ORIGINS
OPENAI_API_KEY
GEMINI_API_KEY
GROQ_API_KEY
```

Extension:

```js
// extension/src/config.js
self.TRUTHLAYER_CONFIG = {
    API_URL: 'https://your-backend-service.onrender.com/analyze',
    VERSION_URL: 'https://your-backend-service.onrender.com/version',
    ENABLE_DEV_RELOAD: false
};
```

## Deploy AI Service on Hugging Face Spaces

1. Create a Hugging Face account at `https://huggingface.co`.
2. Click your profile, then `New Space`.
3. Set the Space name, for example `truthlayer-ai-service`.
4. Choose `Docker` as the SDK.
5. Choose visibility. Use `Public` for simplest backend access.
6. Keep hardware as `CPU Basic`.
7. Create the Space.
8. Upload the contents of `ai-service/` to the Space repository.
9. Rename or copy `ai-service/README.hf.md` to `README.md` in the Space repo so the Docker SDK metadata is at the top of the Space README.
10. Make sure these files exist in the Space repo:

```text
Dockerfile
requirements.txt
app.py
app/
models/model.pkl
models/vectorizer.pkl
```

11. In the Space, open `Settings`.
12. Add secrets for any external AI provider you will use:

```text
GROQ_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

13. Add this variable if needed:

```text
CORS_ORIGINS=*
```

14. Wait for the Space to build.
15. Test:

```bash
curl https://YOUR_USERNAME-truth-layer-ai-service.hf.space/health
```

Expected response includes:

```json
{
  "status": "ok",
  "ml_available": true
}
```

The backend AI URL will be:

```text
https://YOUR_USERNAME-truth-layer-ai-service.hf.space/analyze
```

## Deploy Backend on Render

1. Push this repository to GitHub.
2. Create a Render account at `https://render.com`.
3. Click `New +`.
4. Choose `Web Service`.
5. Connect your GitHub account.
6. Select the TruthLayer repository.
7. Configure the service:

```text
Name: truthlayer-backend
Runtime: Node
Root Directory: backend
Build Command: npm ci
Start Command: npm start
Instance Type: Free
```

8. Add environment variables:

```text
NODE_ENV=production
AI_SERVICE_URL=https://YOUR_USERNAME-truthlayer-ai-service.hf.space/analyze
AI_SERVICE_TIMEOUT_MS=45000
CORS_ORIGIN=*
```

Do not manually set `PORT` on Render unless needed. Render provides it automatically.

9. Click `Create Web Service`.
10. Wait for the build and deploy.
11. Test:

```bash
curl https://truthlayer-backend.onrender.com/version
```

12. Test the full backend to AI path:

```bash
curl -X POST https://truthlayer-backend.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"Breaking news sample text for credibility analysis","url":"https://example.com","source":"example.com"}'
```

## Configure the Extension for Judges

Update `extension/src/config.js` after the backend URL exists:

```js
self.TRUTHLAYER_CONFIG = {
    API_URL: 'https://truthlayer-backend.onrender.com/analyze',
    VERSION_URL: 'https://truthlayer-backend.onrender.com/version',
    ENABLE_DEV_RELOAD: false
};
```

For a stricter manifest, replace `<all_urls>` in `extension/manifest.json` with the sites and APIs used by the demo:

```json
"host_permissions": [
  "https://*.facebook.com/*",
  "https://truthlayer-backend.onrender.com/*",
  "https://YOUR_USERNAME-truthlayer-ai-service.hf.space/*",
  "https://*/*",
  "http://*/*"
]
```

For judging, `<all_urls>` is acceptable because the extension analyzes arbitrary article pages and injects on Facebook.

Judges install it like this:

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `extension/` folder.
5. Pin TruthLayer.
6. Open Facebook or an article page and test.

## API Communication

Extension to backend:

```text
POST https://truthlayer-backend.onrender.com/analyze
```

Backend to AI service:

```text
POST https://YOUR_USERNAME-truthlayer-ai-service.hf.space/analyze
```

Only the backend needs to know the AI service URL. Keep provider API keys only in the AI service host settings.

## Free Tier Limitations

Render Free:

- Sleeps after idle traffic.
- First request after sleep can take about a minute.
- Filesystem is ephemeral.
- Good for demos, not production traffic.

Hugging Face Spaces CPU Basic:

- Free CPU Basic is suitable for scikit-learn demos.
- Sleeps after a longer inactive period.
- First request after sleep can be slow while the container starts.
- Disk is not persistent unless paid persistent storage is added, so keep `models/*.pkl` committed or uploaded with the Space.

## Demo Reliability Checklist

Before judging:

1. Open the Hugging Face Space URL and wait until `/health` works.
2. Open the Render backend `/version`.
3. Send one sample `/analyze` request to warm both services.
4. Reload the unpacked extension after editing `extension/src/config.js`.
5. Keep a browser tab open to the backend `/version` or refresh it occasionally before the live demo.

## Security

- Do not commit `.env`.
- Store external provider keys as Render environment variables or Hugging Face secrets.
- For the demo, `CORS_ORIGIN=*` is practical because Chrome extension origins vary when loaded unpacked.
- If publishing beyond judging, restrict CORS to your extension ID and add a backend API key.
- Do not put OpenAI, Gemini, or Groq keys in the extension.

## Performance

- Keep model files bundled with the AI service image/repo so startup does not download them.
- Use one uvicorn worker on free CPU to avoid loading model files multiple times.
- Use the backend timeout value `AI_SERVICE_TIMEOUT_MS=45000` during demos.
- Warm the services five to ten minutes before judging.
- Add caching later in the backend for identical text or URL requests if repeated Facebook posts cause duplicate analyses.

## Common Errors

`ML model unavailable`: `models/model.pkl` or `models/vectorizer.pkl` is missing from the AI service deployment.

`Server responded with 502` from the extension: Render backend is sleeping, crashed, or `AI_SERVICE_URL` is wrong.

`CORS error`: set backend `CORS_ORIGIN=*` for judging and reload the service.

`Hugging Face Space stuck building`: check Docker logs, requirements install errors, and that the Space README contains `sdk: docker`.

`Render cannot detect port`: make sure the backend uses `process.env.PORT`; this repo does.

