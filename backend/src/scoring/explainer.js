/**
 * Explainability Engine
 * 
 * Converts scoring data into human-readable explanations
 * helping users understand why content received a certain score
 */

/**
 * Generate comprehensive explanation for credibility assessment
 * 
 * @param {Object} analysisResult - Complete analysis result with all scores
 * @returns {Object} Explanation with narrative and detailed breakdown
 */
function generateExplanation(analysisResult) {
    const {
        finalScore,
        confidence,
        label,
        breakdown,
        ruleReasons = [],
        mlExplanation = '',
        sourceReason = ''
    } = analysisResult;

    const explanations = [];
    const details = [];

    // Rule-based findings
    if (ruleReasons && ruleReasons.length > 0) {
        explanations.push(`Detected language patterns: ${ruleReasons.slice(0, 2).join('; ')}`);
        details.push({
            category: 'Language Analysis',
            findings: ruleReasons,
            priority: 'high'
        });
    }

    // ML model prediction
    if (mlExplanation) {
        explanations.push(mlExplanation);
        details.push({
            category: 'AI Analysis',
            findings: [mlExplanation],
            priority: 'high'
        });
    }

    // Source credibility
    if (sourceReason) {
        explanations.push(sourceReason);
        details.push({
            category: 'Source Credibility',
            findings: [sourceReason],
            priority: 'medium'
        });
    }

    // Confidence note
    if (confidence < 0.4) {
        explanations.push('⚠ Low confidence: Multiple scoring methods show mixed signals');
    } else if (confidence > 0.8) {
        explanations.push('✓ High confidence: Multiple scoring methods agree');
    }

    // Generate narrative summary
    const narrative = generateNarrative(finalScore, confidence, label);

    return {
        narrative,
        summary: explanations.join(' | '),
        details,
        score: finalScore,
        confidence,
        label,
        breakdown
    };
}

/**
 * Generate human-readable narrative based on score and confidence
 * 
 * @param {number} score - Final credibility score
 * @param {number} confidence - Confidence level
 * @param {string} label - Risk label
 * @returns {string} Narrative explanation
 */
function generateNarrative(score, confidence, label) {
    let narrative = '';

    // Base narrative on score
    if (label === 'Likely Credible') {
        narrative = `This content appears credible (${score}/100). `;
        if (confidence > 0.7) {
            narrative += 'Language patterns align with factual reporting. Source appears reliable.';
        } else {
            narrative += 'However, some indicators suggest caution.';
        }
    } else if (label === 'Needs Verification') {
        narrative = `This content shows mixed signals (${score}/100). `;
        narrative += 'Some language patterns are concerning, but the source or AI analysis offers some reassurance.';
    } else if (label === 'Low Credibility') {
        narrative = `This content exhibits credibility concerns (${score}/100). `;
        narrative += 'Multiple red flags detected including sensational language, unverified sources, or suspicious patterns.';
    } else {
        narrative = `Unable to confidently assess this content (${score}/100). `;
        narrative += 'Scoring methods show conflicting signals. Consider checking additional sources.';
    }

    if (confidence < 0.3) {
        narrative += ' Recommendation: Verify with additional fact-checking sources.';
    } else if (confidence > 0.8) {
        narrative += ' Assessment is based on consistent indicators.';
    }

    return narrative;
}

/**
 * Format explanation for different audiences (technical, general user, etc)
 * 
 * @param {Object} explanation - Generated explanation
 * @param {string} audience - Target audience ('general', 'technical', 'brief')
 * @returns {Object} Formatted explanation
 */
function formatForAudience(explanation, audience = 'general') {
    if (audience === 'technical') {
        return {
            ...explanation,
            narrative: explanation.narrative + ` [Confidence: ${(explanation.confidence * 100).toFixed(1)}%, Score: ${explanation.score}]`,
            showBreakdown: true,
            showDetails: true
        };
    }

    if (audience === 'brief') {
        return {
            label: explanation.label,
            score: explanation.score,
            narrative: explanation.narrative,
            emoji: getEmojiForLabel(explanation.label)
        };
    }

    // Default: general audience
    return {
        label: explanation.label,
        score: explanation.score,
        narrative: explanation.narrative,
        summary: explanation.summary,
        details: explanation.details.map(d => ({
            category: d.category,
            findings: d.findings.slice(0, 2) // Limit to top 2 findings per category
        }))
    };
}

/**
 * Get appropriate emoji for label
 * @param {string} label - Risk label
 * @returns {string} Emoji character
 */
function getEmojiForLabel(label) {
    const emojiMap = {
        'Likely Credible': '✓',
        'Needs Verification': '⚠',
        'Low Credibility': '✗',
        'Uncertain': '?'
    };
    return emojiMap[label] || '?';
}

/**
 * Extract key findings for quick assessment
 * 
 * @param {Object} explanation - Generated explanation
 * @returns {Array} Top concerns/highlights
 */
function extractKeyFindings(explanation) {
    const findings = [];

    // Add score context
    if (explanation.score <= 40) {
        findings.push('Multiple credibility red flags detected');
    } else if (explanation.score < 70) {
        findings.push('Mixed credibility signals present');
    }

    // Add top details
    if (explanation.details && explanation.details.length > 0) {
        explanation.details.forEach(detail => {
            if (detail.findings && detail.findings.length > 0) {
                findings.push(detail.findings[0]);
            }
        });
    }

    return findings.slice(0, 3); // Top 3 findings
}

module.exports = {
    generateExplanation,
    generateNarrative,
    formatForAudience,
    getEmojiForLabel,
    extractKeyFindings
};
