# TruthLayer Architecture

TruthLayer is split into three runtime layers:

- `extension/`: browser extraction, Facebook DOM integration, popup rendering, and background messaging.
- `backend/`: Express API gateway, source scoring, local fallback scoring, explanation generation, and integration with the AI service.
- `ai-service/`: FastAPI application, ML model loading, rule engine, external AI/RAG, and final AI-service scoring.

The extension should call only the Node backend. The backend is the compatibility boundary for browser clients and can evolve independently from the Python inference service.

