---
title: TruthLayer AI Service
emoji: 🧠
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8000
---

# TruthLayer AI Service

FastAPI inference service for the TruthLayer Chrome extension demo.

Health check:

```text
/health
```

Analyze endpoint:

```text
/analyze
```

Configure API keys in Space Settings as secrets:

```text
OPENAI_API_KEY
GEMINI_API_KEY
GROQ_API_KEY
```

