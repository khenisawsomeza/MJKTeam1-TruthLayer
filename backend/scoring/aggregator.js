/**
 * Score Aggregator
 * 
 * Combines multiple scoring inputs into a final credibility score
 * using weighted averaging:
 * 
 * - Rule-based score: 25%
 * - ML score: 25%
 * - Source score: 50%
 * 
 * Also calculates confidence based on agreement between methods
 */

/**
 * Aggregate multiple scoring inputs into final score
 * 
 * @param {Object} scores - Scoring inputs
 * @param {number} scores.ruleScore - Rule-based score (0-100)
 * @param {number} scores.mlScore - ML model score (0-100)
 * @param {number} scores.sourceScore - Source credibility score (0-100)
 * @param {number} scores.mlConfidence - ML model confidence (0-1)
 * 
 * @returns {Object} Aggregated result with final score and confidence
 */
function aggregateScores(scores) {
    const { ruleScore = 50, mlScore = 50, sourceScore = 50, mlConfidence = 0.2 } = scores;

    // Validate scores are in range
    const rule = Math.max(0, Math.min(100, ruleScore || 50));
    const ml = Math.max(0, Math.min(100, mlScore || 50));
    const source = Math.max(0, Math.min(100, sourceScore || 50));

    // Weighted average
    // Source is intentionally strongest to prioritize source credibility
    const finalScore = (rule * 0.25) + (ml * 0.25) + (source * 0.5);

    // Calculate confidence
    // Confidence is based on:
    // 1. ML model's own confidence
    // 2. Agreement between different scoring methods
    
    const methodAgreement = calculateMethodAgreement(rule, ml, source);
    const combinedConfidence = (mlConfidence * 0.3) + (methodAgreement * 0.7);

    return {
        finalScore: Math.round(finalScore * 10) / 10,
        confidence: Math.round(combinedConfidence * 100) / 100,
        breakdown: {
            rule: Math.round(rule * 10) / 10,
            ml: Math.round(ml * 10) / 10,
            source: Math.round(source * 10) / 10
        },
        weights: {
            rule: 0.25,
            ml: 0.25,
            source: 0.5
        }
    };
}

/**
 * Calculate how much the different scoring methods agree
 * 
 * Agreement = 1.0 when all methods agree
 * Agreement = 0.0 when methods completely disagree
 * 
 * @param {number} ruleScore - Rule score
 * @param {number} mlScore - ML score
 * @param {number} sourceScore - Source score
 * @returns {number} Agreement score (0-1)
 */
function calculateMethodAgreement(ruleScore, mlScore, sourceScore) {
    // Calculate pairwise differences
    const ruleMlDiff = Math.abs(ruleScore - mlScore) / 100;
    const ruleSourceDiff = Math.abs(ruleScore - sourceScore) / 100;
    const mlSourceDiff = Math.abs(mlScore - sourceScore) / 100;

    // Average difference
    const avgDiff = (ruleMlDiff + ruleSourceDiff + mlSourceDiff) / 3;

    // Convert difference to agreement (1 - diff)
    const agreement = 1 - avgDiff;

    return agreement;
}

/**
 * Determine risk label based on score
 * 
 * @param {number} score - Final credibility score (0-100)
 * @param {number} confidence - Confidence level (0-1)
 * @returns {string} Risk label
 */
function determineLabel(score, confidence) {
    // If confidence is extremely low, return "Uncertain"
    // We lowered this from 0.2 to 0.1 to allow source-based results to show
    if (confidence < 0.1) {
        return 'Uncertain';
    }

    if (score >= 80) {
        return 'Low Risk';
    } else if (score >= 60) {
        return 'Likely Credible';
    } else if (score >= 40) {
        return 'Medium Risk';
    } else if (score >= 20) {
        return 'High Risk';
    } else {
        return 'Critical Risk';
    }
}

module.exports = {
    aggregateScores,
    calculateMethodAgreement,
    determineLabel
};
