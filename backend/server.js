const express = require('express');
const cors = require('cors');
const axios = require('axios');
const scoring = require('./scoring');

const app = express();
const PORT = process.env.PORT || 3000;
const AI_SERVICE_URL = 'http://localhost:8000/analyze';

// Middlewares
app.use(cors()); // Allow requests from extension
app.use(express.json());

app.post('/analyze', async (req, res) => {
    try {
        const { text, content, url, source, platform } = req.body;
        const articleText = text || content;
        
        if (!articleText) {
            return res.status(400).json({ error: "Text or content is required" });
        }

        console.log(`Analyzing: ${url || 'no URL'} (${articleText.length} chars)`);
        if (source) {
            console.log(`Source detected: ${source.name || source.url || 'unknown'}`);
        }

        // 1. Local Rule-based analysis
        const ruleResult = scoring.rules.analyze(articleText);

        // 2. Local Source analysis
        const sourceResult = scoring.sourceChecker.getSourceScore(source || { url, platform });

        // 3. AI Service analysis (ML)
        let aiResult = null;
        try {
            const response = await axios.post(AI_SERVICE_URL, { 
                text: articleText,
                source_score: sourceResult.score 
            });
            aiResult = response.data;
        } catch (aiError) {
            console.error("AI Service unavailable, using local fallback");
        }

        // 4. Aggregate results
        let aggregated;
        if (aiResult && aiResult.score !== undefined) {
            // Use the Python backend's unified score directly
            aggregated = {
                finalScore: aiResult.score,
                confidence: aiResult.confidence,
                breakdown: aiResult.breakdown
            };
        } else {
            // Fallback to local aggregation if AI service fails
            aggregated = scoring.aggregator.aggregate({
                ruleScore: ruleResult.score,
                mlScore: 50,
                sourceScore: sourceResult.score,
                mlConfidence: 0.1
            });
        }

        // 5. Generate human-readable explanation
        const explanation = scoring.explainer.generate({
            finalScore: aggregated.finalScore,
            confidence: aggregated.confidence,
            label: scoring.aggregator.determineLabel(aggregated.finalScore, aggregated.confidence),
            breakdown: aggregated.breakdown,
            ruleReasons: ruleResult.reasons,
            mlExplanation: aiResult ? aiResult.reasons[aiResult.reasons.length - 1] : 'AI analysis unavailable',
            sourceReason: sourceResult.reason
        });

        // Final response structure (enriched for extension)
        const finalResponse = {
            success: true,
            score: aggregated.finalScore,
            credibilityScore: aggregated.finalScore,
            label: explanation.label,
            classification: explanation.label,
            confidence: aggregated.confidence,
            reasons: explanation.summary.split(' | '),
            keyRiskIndicators: scoring.explainer.extractKeyFindings(explanation),
            narrative: explanation.narrative,
            sourceInfo: sourceResult,
            breakdown: aggregated.breakdown
        };

        res.json(finalResponse);

    } catch (error) {
        console.error("Error in analysis pipeline:", error.message);
        
        res.json({
            success: false,
            score: 50,
            credibilityScore: 50,
            label: "Unable to Verify",
            reasons: [
                "Analysis pipeline encountered an error.",
                error.message
            ]
        });
    }
});

app.get('/version', (req, res) => {
    res.json({ version: '1.1.0' });
});

app.listen(PORT, () => {
    console.log(`TruthLayer Backend running on http://localhost:${PORT}`);
});