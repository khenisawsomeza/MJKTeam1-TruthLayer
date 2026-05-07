# Repository Guidelines

## Project Structure & Module Organization
`extension/` contains the Chrome extension UI and browser scripts under `extension/src/`, static icons under `extension/assets/`, and CSS under `extension/styles/`. `backend/` contains the Node/Express API entrypoint wrapper in `server.js`, with the app, routes, controllers, services, and scoring modules under `backend/src/`. `ai-service/` contains the FastAPI app package under `ai-service/app/`, training code under `ai-service/training/`, Python dependencies, and generated model artifacts under `ai-service/models/`. Root-level HTML files and `test-system.sh` are manual test fixtures and diagnostics, not production modules.

## Build, Test, and Development Commands
Install backend dependencies with `cd backend && npm install`. Start the API with `cd backend && npm start` to serve `http://localhost:3000`. Start the ML service with `cd ai-service && pip install -r requirements.txt` then `python -m uvicorn app.main:app --reload --port 8000`. The compatibility import `app:app` is also preserved. Retrain the model with `cd ai-service && python training/train.py`. Run the manual smoke script with `bash test-system.sh`; it checks local prerequisites, model files, and live endpoints.

## Coding Style & Naming Conventions
Follow the surrounding file style instead of reformatting whole files. JavaScript uses `const`/`let`, semicolons, and descriptive camelCase names such as `renderScore` and `sourceChecker`. Python follows standard 4-space indentation and snake_case names such as `calculate_rule_score`. Keep extension assets and filenames explicit (`popup.html`, `facebook.css`, `TruthLayerLogo128.png`). No formatter or linter is configured, so keep diffs small and consistent.

## Testing Guidelines
This repo currently relies on manual and script-based testing rather than Jest or Pytest. Validate backend changes with a POST to `/analyze` and verify `/version`; validate AI changes with `GET /health` and a sample `/analyze` request. When changing extension behavior, reload the unpacked extension in Chrome and test against the supplied HTML fixtures or a live Facebook page.

## Commit & Pull Request Guidelines
Recent commits use short, imperative, lower-case summaries such as `changed logo` and `refined restore icon position`. Keep commit messages focused on one behavior change. Pull requests should include a concise description, affected area (`extension`, `backend`, or `ai-service`), manual test steps, and screenshots or screen recordings for popup or content-script UI changes.

## Configuration Notes
The backend expects the AI service at `http://localhost:8000/analyze`. If you change ports or routes, update both services and any test scripts together.
