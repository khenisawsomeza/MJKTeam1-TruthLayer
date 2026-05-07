const analysisPipeline = require('../services/analysisPipeline');

async function analyze(req, res) {
    try {
        const finalResponse = await analysisPipeline.analyzeContent(req.body);
        res.json(finalResponse);
    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({ error: error.message });
        }

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
}

module.exports = {
    analyze
};

