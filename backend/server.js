const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const AI_SERVICE_URL = 'http://127.0.0.1:8000/analyze';

// Middlewares
app.use(cors()); // Allow requests from extension
app.use(express.json());

app.post('/analyze', async (req, res) => {
    try {
        const { text, content, url } = req.body;
        const articleText = text || content;
        
        if (!articleText) {
            console.warn("Received empty analysis request");
            return res.status(400).json({ error: "Text or content is required" });
        }

        console.log(`TruthLayer: Analyzing content from ${url || 'unknown source'} (${articleText.length} chars)`);

        // Forward request to Python AI Service
        try {
            const response = await axios.post(AI_SERVICE_URL, { text: articleText });
            console.log(`TruthLayer: AI service responded with score ${response.data.score}`);
            res.json(response.data);
        } catch (aiError) {
            console.error("TruthLayer: Python service unreachable or error:", aiError.message);
            // Fallback response if Python service is down
            res.json({
                score: 50,
                label: "Service Offline",
                reasons: [
                    "The TruthLayer AI scoring engine is currently unreachable.",
                    "Check if the Python service is running on port 8000.",
                    "Using heuristic fallback: No immediate high-risk patterns detected."
                ]
            });
        }

    } catch (error) {
        console.error("TruthLayer: Backend processing error:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, () => {
    console.log(`TruthLayer Backend running on http://localhost:${PORT}`);
});
