# TruthLayer Project Overview

## Project Name

- **Project name:** TruthLayer
- **Status:** Hackathon project documentation draft

## About the Project

- **Official Theme:** Build from Anywhere, Build Anything!
- This project is part of a creative build challenge focused on technical freedom and innovation.

## Project Purpose

- TruthLayer is built to help users make better judgments about the credibility of online content.
- The project addresses the growing difficulty of evaluating social posts, articles, and viral claims quickly and responsibly.
- Its goal is to turn complex credibility signals into a simple, understandable result for the user.

## What the Project Is

- TruthLayer is an AI-assisted credibility analysis tool designed to help users quickly assess whether online content looks trustworthy, suspicious, or in need of further verification.
- In its current implementation, the project functions mainly as a **Chrome extension** with supporting backend services.
- The extension can analyze content from browser pages and currently includes specific support for **Facebook feed/post workflows**.
- The system combines rule-based checks, source evaluation, and machine learning or external AI signals to generate a credibility score, confidence value, and explanation.

## Domain Fit

- **Primary domain: Intelligence Systems & Data**
  - The project uses AI/ML, scoring logic, and supporting evidence workflows to transform raw content into an interpretable credibility assessment.
- **Why it fits**
  - It is both an analysis system and a practical decision-support tool.
  - It turns unstructured text and source signals into structured outputs such as scores, labels, reasons, and confidence.

## How the Project Works

### High-Level Flow

1. A user opens content in the browser and triggers analysis through the TruthLayer extension or via supported page detection.
2. The extension gathers post or article text and, when available, source information such as page name, URL, or platform context.
3. The extension sends the content payload to the local Node/Express backend at `http://localhost:3000/analyze`.
4. The backend runs local scoring logic:
   - rule-based content analysis
   - source credibility analysis
5. The backend also calls the FastAPI AI service at `http://localhost:8000/analyze`.
6. The AI service evaluates the content using:
   - a trained ML model
   - internal rule scoring
   - external AI or evidence-assisted reasoning
   - source score passed from the backend
7. The AI service returns scores, confidence, reasons, and a breakdown.
8. The backend formats the final result into a response the extension can display to the user.
9. The extension presents a credibility label, score, and explanation in the browser UI.

### Current System Behavior Notes

- The extension is browser-facing and user-interactive.
- The backend acts as the orchestration layer between UI logic and analysis services.
- The AI service is responsible for ML inference and score synthesis.
- If the AI service is unavailable, the backend can still return a fallback result using local logic.

## Key Features or Components

### Browser Extension

- Chrome Manifest V3 extension
- Popup UI for running or viewing analysis
- Background service worker for message handling and API communication
- Content script for Facebook page/post detection and inline UI behavior
- Local browser storage support for pause and dismissal states

### Backend API

- Express-based API server
- Main `/analyze` endpoint for content scoring
- `/version` endpoint for extension development support
- CORS enabled for local extension communication
- Modular scoring system under `backend/scoring/`

### Scoring Modules

- `rules.js`
  - evaluates text patterns and credibility red flags
- `sourceChecker.js`
  - evaluates source/page/domain credibility indicators
- `aggregator.js`
  - combines scoring outputs into a final score
- `explainer.js`
  - converts technical results into user-facing explanations

### AI Service

- FastAPI application in `ai-service/app.py`
- Local ML model files: `model.pkl` and `vectorizer.pkl`
- Training script in `ai-service/train.py`
- Health check endpoint at `/health`
- Support for external AI or evidence-enhanced reasoning through additional service integrations

## Setup Instructions

### Backend Setup

- Go to `backend/`
- Run `npm install`
- Start the backend with `npm start`
- Expected local URL: `http://localhost:3000`

### AI Service Setup

- Go to `ai-service/`
- Install dependencies with `pip install -r requirements.txt`
- If needed, train the model with `python train.py`
- Start the service with `python -m uvicorn app:app --reload --port 8000`
- Expected local URL: `http://localhost:8000`

### Extension Setup

- Open Chrome and go to the Extensions page
- Enable Developer Mode
- Load the `extension/` folder as an unpacked extension
- Verify that the backend and AI service are already running locally before testing

### Basic Verification

- Check backend version at `http://localhost:3000/version`
- Check AI service health at `http://localhost:8000/health`
- Test content analysis through the extension or by posting to `/analyze`

## Tech Stack

- **Frontend / Client**
  - Chrome Extension (Manifest V3)
  - HTML
  - CSS
  - JavaScript
- **Backend**
  - Node.js
  - Express
  - Axios
  - CORS
- **AI / ML Service**
  - Python
  - FastAPI
  - Uvicorn
  - scikit-learn
  - joblib
  - NumPy
  - Pydantic
- **Supporting Integrations / Libraries**
  - `requests`
  - `beautifulsoup4`
  - `ddgs`
  - `huggingface-hub`
  - `openai`
- `google-generativeai`
- `groq`

## Notes

- The current primary use case is credibility analysis for social posts and web content, especially Facebook content.
- **Note:** The backend currently expects the AI service at `http://localhost:8000/analyze`.

## Future Expansion Areas

- Expand beyond Facebook-focused workflows into broader web article and platform coverage
- Strengthen source validation through more trusted evidence and verification sources
- Improve privacy, transparency, and explanation quality for end users
- Add sample screenshots, demo flow visuals, and architecture diagrams for future presentations
