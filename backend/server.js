const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const AI_SERVICE_URL = 'http://localhost:8000/analyze';

// Middlewares
app.use(cors()); // Allow requests from extension
app.use(express.json());

app.post('/analyze', async (req, res) => {
    try {
        const { text, content, url } = req.body;
        const articleText = text || content;
        
        if (!articleText) {
            return res.status(400).json({ error: "Text or content is required" });
        }

        console.log(`Analyzing: ${url || 'no URL'} (${articleText.length} chars)`);

        // Forward request to Python AI Service
        const response = await axios.post(AI_SERVICE_URL, { text: articleText });
        
        // Return AI response to the extension
        res.json(response.data);

    } catch (error) {
        console.error("Error communicating with AI service:", error.message);
        
        // Fallback response if Python service is down (still return 200 so extension can display it)
        res.json({
            score: 50,
            label: "Unable to Verify",
            reasons: [
                "AI scoring service is offline.",
                "Could not perform full credibility analysis.",
                "Treat this content with caution until verified."
            ]
        });
    }
});

app.listen(PORT, () => {
    console.log(`TruthLayer Backend running on http://localhost:${PORT}`);
});