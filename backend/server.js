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
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        // Forward request to Python AI Service
        const response = await axios.post(AI_SERVICE_URL, { text });
        
        // Return AI response to the extension
        res.json(response.data);

    } catch (error) {
        console.error("Error communicating with AI service:", error.message);
        
        // Fallback response if Python service is down
        res.status(503).json({
            score: 100,
            label: "Unknown",
            reasons: ["Failed to connect to AI scoring service."]
        });
    }
});

app.listen(PORT, () => {
    console.log(`TruthLayer Backend running on http://localhost:${PORT}`);
});
