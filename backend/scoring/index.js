/**
 * TruthLayer Scoring System - Module Index
 * 
 * This file provides a unified interface to all scoring modules
 */

const rules = require('./rules');
const sourceChecker = require('./sourceChecker');
const aggregator = require('./aggregator');
const explainer = require('./explainer');

module.exports = {
    // Rule-based scoring
    rules: {
        analyze: rules.analyzeRules,
        SENSATIONAL_KEYWORDS: rules.SENSATIONAL_KEYWORDS,
        CLICKBAIT_PATTERNS: rules.CLICKBAIT_PATTERNS
    },

    // Source credibility checking
    sourceChecker: {
        getSourceScore: sourceChecker.getSourceScore,
        analyze: sourceChecker.analyzeSource,
        extractDomain: sourceChecker.extractDomain,
        isTrusted: sourceChecker.isTrustedDomain,
        isSuspicious: sourceChecker.isSuspiciousDomain,
        cleanPageName: sourceChecker.cleanPageName,
        TRUSTED_DOMAINS: sourceChecker.TRUSTED_DOMAINS,
        TRUSTED_PAGES: sourceChecker.TRUSTED_PAGES,
        SUSPICIOUS_DOMAINS: sourceChecker.SUSPICIOUS_DOMAINS
    },

    // Score aggregation
    aggregator: {
        aggregate: aggregator.aggregateScores,
        calculateAgreement: aggregator.calculateMethodAgreement,
        determineLabel: aggregator.determineLabel
    },

    // Explainability
    explainer: {
        generate: explainer.generateExplanation,
        formatForAudience: explainer.formatForAudience,
        extractKeyFindings: explainer.extractKeyFindings
    }
};
