# Development

This guide starts the full local TruthLayer system after the architecture refactor.

## Project Layout

```text
TruthLayer/
├── ai-service/          # FastAPI ML and external AI service
├── backend/             # Node/Express API gateway used by the extension
├── extension/           # Chrome extension loaded as unpacked extension
├── shared/              # API contracts and shared constants documentation
└── test-system.sh       # Manual smoke-check script
```

## Prerequisites

- Python 3.9+
- Node.js
- Chrome or Chromium
- Backend dependencies installed with `cd backend && npm install`
- AI service dependencies installed in a virtual environment or active Python environment

Install AI service dependencies:

```bash
cd ai-service
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

If `ai-service/venv` already exists, you can reuse it.

## Start The System

Use two separate terminal windows.

Terminal 1, start the AI service:

```bash
cd ai-service
./venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Expected health check:

```bash
curl -s http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok","ml_available":true,"service":"TruthLayer AI Service"}
```

Terminal 2, start the Node backend:

```bash
cd backend
npm start
```

Expected version check:

```bash
curl -s http://localhost:3000/version
```

Expected response:

```json
{"version":"1.1.0"}
```

## Test The Backend Analyze Endpoint

With both services running:

```bash
curl -s -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "SHOCKING: You wont believe this!!!",
    "url": "https://unknown.com"
  }'
```

The response should include these extension-facing fields:

```json
{
  "success": true,
  "score": 50,
  "credibilityScore": 50,
  "label": "Needs Verification",
  "classification": "Needs Verification",
  "confidence": 0.5,
  "reasons": []
}
```

Exact scores and reasons can vary when external AI/RAG is configured, but the response shape must remain compatible.

## Run The Smoke Script

From the project root:

```bash
bash test-system.sh
```

The script checks:

- Python and Node availability
- AI service `/health`
- Backend `/version`
- ML model files in `ai-service/models/`
- Backend `/analyze` when the backend is running

## Load The Chrome Extension

1. Open `chrome://extensions/`.
2. Enable Developer Mode.
3. Click Load unpacked.
4. Select the `extension/` folder.
5. Pin TruthLayer.
6. Open Facebook to test automatic post analysis, or open any article and click the extension popup.

The extension calls:

```text
extension -> http://localhost:3000/analyze -> http://localhost:8000/analyze
```

Do not point the extension directly at the FastAPI service.

## Important Paths

```text
ai-service/app/main.py                      # FastAPI app entrypoint
ai-service/app/api/routes/analyze.py        # AI service /analyze route
ai-service/app/api/routes/health.py         # AI service /health route
ai-service/app/services/analysis_service.py # AI service scoring orchestration
ai-service/models/model.pkl                 # Trained ML model
ai-service/models/vectorizer.pkl            # Trained vectorizer
ai-service/training/train.py                # Model training script

backend/src/server.js                       # Express server entrypoint
backend/src/app.js                          # Express app setup
backend/src/routes/analyze.routes.js        # Backend /analyze route
backend/src/services/analysisPipeline.js    # Backend analysis orchestration
backend/src/scoring/                        # Backend rule/source/explainer modules

extension/manifest.json                     # Chrome extension manifest
extension/src/background/index.js           # Background service worker entrypoint
extension/src/content/facebookContent.js    # Facebook content script
extension/src/popup/popup.html              # Popup UI
extension/src/popup/popup.js                # Popup controller
```

## Retrain The Model

From `ai-service/`:

```bash
./venv/bin/python training/train.py
```

This writes:

```text
ai-service/models/model.pkl
ai-service/models/vectorizer.pkl
```

Restart the AI service after retraining.

## Stop Running Services

Press `Ctrl+C` in each service terminal.

If a service is stuck, find listeners:

```bash
lsof -nP -iTCP:3000 -iTCP:8000 -sTCP:LISTEN
```

Then kill the specific PID:

```bash
kill <PID>
```

## Troubleshooting

If port `3000` is already in use:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill <PID>
```

If port `8000` is already in use:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
kill <PID>
```

If `python` is not found, use `python3` or the project venv:

```bash
./venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

If you see sklearn pickle version warnings, the service can still start, but the model was trained with a different sklearn version than the current environment. Retrain with:

```bash
cd ai-service
./venv/bin/python training/train.py
```

If `.env` parse warnings appear, check `ai-service/.env` formatting. Each value should be one key-value pair:

```text
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
```

