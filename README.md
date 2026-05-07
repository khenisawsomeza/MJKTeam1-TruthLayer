# TruthLayer

TruthLayer is an AI-assisted credibility analysis tool designed to help users evaluate the trustworthiness of online content in real-time. By turning complex credibility signals into simple, understandable labels, TruthLayer empowers users to make better judgments about social posts, articles, and viral claims.

## 1. What the Project is
TruthLayer is a browser-based ecosystem (currently a Chrome Extension) that assesses whether content looks trustworthy, suspicious, or in need of further verification. While it is specifically optimized for **Facebook feed and post workflows** with inline banners, it also enables users to **manually analyze any website or article** by clicking the extension popup while on the page.

### Core Objectives
- **Combat Misinformation**: Provide immediate friction and warnings for high-risk content.
- **Explainable AI**: Instead of a simple "true/false," it provides scores, confidence levels, and clear reasoning.
- **Source Verification**: Analyzes not just the text, but the reputation of the source or page sharing it.

---

## 2. How it Works
TruthLayer utilizes a three-tier architecture to deliver real-time analysis:

### The Analysis Flow
1.  **Detection & Extraction**: The **Chrome Extension** operates in two modes:
    - **Automatic**: It monitors the browser DOM (specifically Facebook) to detect and analyze posts as they appear.
    - **Manual**: Users can click the extension popup on any website or article to trigger a real-time credibility check of the current page's content.
2.  **Orchestration**: The extension sends the payload to the **Node.js Backend**. The backend runs a modular scoring system:
    - **Rule-based checks**: Evaluates sensationalism, clickbait patterns, and linguistic red flags.
    - **Source Credibility**: Checks the page or domain against a database of known indicators.
3.  **AI Reasoning**: The backend forwards the data to the **FastAPI AI Service**. This service uses a hybrid approach:
    - **ML Inference**: A trained model classifies the text based on learned features.
    - **LLM Integration**: Leverages advanced AI (OpenAI, Gemini, Groq) to perform deep reasoning and evidence-assisted fact-checking.
4.  **Feedback Loop**: The synthesized score (0-100), confidence level, and explanation are sent back through the layers.
5.  **UI Injection**: The extension renders a color-coded banner (Green for Trusted, Yellow for Suspicious, Red for High Risk) directly onto the social media post, along with a "Why?" toggle for detailed insights.

---

## 3. How to Set it Up

### Prerequisites
- Node.js (v16 or higher)
- Python 3.9+
- Chrome Browser

### Step 1: Backend API
1.  Navigate to the `backend/` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    npm start
    ```
    *The backend will run on `http://localhost:3000`.*

### Step 2: AI Service
1.  Navigate to the `ai-service/` directory.
2.  Create a virtual environment (recommended) and install requirements:
    ```bash
    pip install -r requirements.txt
    ```
3.  Start the service:
    ```bash
    python -m uvicorn app.main:app --reload --port 8000
    ```
    *The AI service will run on `http://localhost:8000`.*

### Step 3: Chrome Extension
1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer Mode** in the top right corner.
3.  Click **Load unpacked**.
4.  Select the `extension/` folder from this repository.
5.  Pin the TruthLayer extension for easy access.

### Verification
- Visit `http://localhost:3000/version` to ensure the backend is alive.
- Visit `http://localhost:8000/health` to check the AI service.
- Open Facebook and look for the TruthLayer analysis banners appearing on posts.
