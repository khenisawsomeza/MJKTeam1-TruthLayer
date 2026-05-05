const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Allow requests from extension
app.use(express.json());

// Rule-based credibility scoring
function analyzeCredibility(text) {
    let score = 100;
    const reasons = [];
    const lowerText = text.toLowerCase();
    const wordCount = text.split(/\s+/).length;
    
    // Sensational words
    const sensationalWords = ['shocking', 'breaking', 'miracle', 'weird trick', 'secret', 'exclusive', 'unbelievable', 'proof', 'warning', 'must watch', 'dont want you to know', 'exposed'];
    sensationalWords.forEach(word => {
        if (lowerText.includes(word)) { score -= 12; reasons.push(`Sensational language: "${word}"`); }
    });
    
    // Capitals
    if ((text.match(/[A-Z]/g) || []).length / text.length > 0.3) { 
        score -= 15; 
        reasons.push("Excessive capitals (emotional manipulation)"); 
    }
    
    // Exclamation marks
    if ((text.match(/!/g) || []).length / wordCount > 0.05) { 
        score -= 10; 
        reasons.push("Multiple exclamation marks"); 
    }
    
    // Questions
    if ((text.match(/\?/g) || []).length > 3) { 
        score -= 8; 
        reasons.push("Excessive questions (clickbait)"); 
    }
    
    // Urgency
    const urgencyWords = ['urgent', 'act now', 'hurry', 'limited time', 'dont miss'];
    urgencyWords.forEach(word => {
        if (lowerText.includes(word)) { score -= 10; reasons.push(`Urgency tactic: "${word}"`); }
    });
    
    // Bias
    const biasCount = ['always', 'never', 'all', 'none'].filter(w => lowerText.includes(w)).length;
    if (biasCount > 3) { score -= 10; reasons.push("Absolute language (potential bias)"); }
    
    // Misinformation keywords
    const misinfoWords = ['fake', 'hoax', 'conspiracy', 'coverup'];
    misinfoWords.forEach(word => {
        if (lowerText.includes(word)) { score -= 15; reasons.push(`Misinformation keyword: "${word}"`); }
    });
    
    // Length check
    if (wordCount < 20) { 
        score -= 15; 
        reasons.push("Very short content"); 
    } else if (wordCount > 500) { 
        score += 5; 
        reasons.push("Substantial content length"); 
    }
    
    score = Math.max(0, Math.min(100, score));
    
    let label = "Credible";
    if (score < 40) label = "Likely Misinformation";
    else if (score < 60) label = "Questionable";
    else if (score < 80) label = "Somewhat Credible";
    
    return { credibilityScore: score, classification: label, keyRiskIndicators: reasons.length > 0 ? reasons : ["No significant red flags detected"] };
}

app.post('/analyze', (req, res) => {
    try {
        const { text, content, url } = req.body;
        const articleText = text || content;
        
        if (!articleText) {
            return res.status(400).json({ error: "Text or content is required" });
        }

        console.log(`Analyzing: ${url || 'no URL'} (${articleText.length} chars)`);

        const analysis = analyzeCredibility(articleText);
        res.json(analysis);

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: "Analysis failed" });
    }
});

app.listen(PORT, () => {
    console.log(`TruthLayer Backend running on http://localhost:${PORT}`);
});