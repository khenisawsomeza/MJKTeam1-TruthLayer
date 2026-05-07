const scoring = require('../scoring');
const aiServiceClient = require('./aiServiceClient');

async function analyzeContent(requestBody) {
    const { text, content, url, source, platform } = requestBody;
    const articleText = text || content;

    if (!articleText) {
        const error = new Error("Text or content is required");
        error.statusCode = 400;
        throw error;
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
        aiResult = await aiServiceClient.analyzeWithAiService({
            text: articleText,
            source_score: sourceResult.score
        });
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
    return {
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
}

module.exports = {
    analyzeContent
};

