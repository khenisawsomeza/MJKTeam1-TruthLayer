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

### Docker Setup for Judges
TruthLayer's backend system can be started with Docker Compose. This runs the Node.js backend and FastAPI AI service together; the Chrome extension stays outside Docker and connects to the backend on `http://localhost:3000`.

This setup works the same way on macOS and Windows once Docker Desktop is installed and running.

#### Requirements
- Docker Desktop installed and running
- Chrome Browser

#### Install Docker Desktop
- macOS: Install Docker Desktop from `https://www.docker.com/products/docker-desktop/`, open Docker Desktop, and wait until it says Docker is running.
- Windows: Install Docker Desktop from `https://www.docker.com/products/docker-desktop/`, enable WSL 2 if prompted, open Docker Desktop, and wait until it says Docker is running.

After installation, confirm Docker is available:

```bash
docker --version
docker compose version
```

#### Run the backend system
From the repository root:

```bash
docker compose up --build
```

Leave this terminal running while testing the extension.

Docker Compose starts:
- `backend` on `http://localhost:3000`
- `ai-service` on `http://localhost:8000`

Inside Docker, the backend talks to the AI service through Docker networking:

```bash
AI_SERVICE_URL=http://ai-service:8000/analyze
```

For local non-Docker development, the backend still defaults to:

```bash
http://localhost:8000/analyze
```

#### Extension setup
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click Load unpacked
4. Select the `extension/` folder

#### Verify the system
In a second terminal, run:

```bash
curl http://localhost:3000/version
curl http://localhost:8000/health
```

Expected results:
- The backend returns a JSON version response.
- The AI service returns a healthy JSON response.

To stop the Docker services, press `Ctrl+C` in the Compose terminal, or run:

```bash
docker compose down
```

#### Development notes
- Source code is bind-mounted into both containers for development.
- Backend hot reload uses Node.js 20 watch mode with `npm run dev`.
- AI service hot reload uses `uvicorn --reload`.
- Container dependencies are isolated from the host through Docker images and volumes.
- The Compose file is organized so future services such as a database, Redis, or additional ML services can be added as new named services.
- If port `3000` or `8000` is already in use, stop the local process using that port before running Docker Compose.

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
