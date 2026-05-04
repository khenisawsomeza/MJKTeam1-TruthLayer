/**
 * Rule-Based Credibility Scoring
 * 
 * Detects common patterns of misinformation:
 * - Sensational language
 * - Excessive punctuation
 * - ALL CAPS words
 * - Clickbait patterns
 * 
 * Returns score (0-100) and list of detected issues
 */

const SENSATIONAL_KEYWORDS = [
    'shocking', 'unbelievable', 'you wont believe', 'you won\'t believe',
    'breaking news', 'exclusive', 'secret', 'hidden', 'proof',
    'must watch', 'must read', 'don\'t want you to know', 'dont want',
    'weird trick', 'doctors hate', 'this one trick', 'miracle',
    'banned', 'warning', 'urgent', 'critical', 'exposed',
    'revealed', 'shocking truth', 'dark secret'
];

const CLICKBAIT_PATTERNS = [
    /\b\d+\s*(million|billion|trillion)\s*people/i,
    /you\s*(won't|wont|won\'t)\s*believe/i,
    /doctors\s*(hate|don't want)/i,
    /this\s*one\s*(trick|simple trick)/i,
    /\$\d+,?\d{3,}\s*(per month|a week|a day)/i,
    /she\/he.*did.*next.*shocked/i,
    /what happens (next|when|after)/i
];

/**
 * Analyze text for rule-based credibility issues
 * @param {string} text - The text to analyze
 * @returns {Object} { score: 0-100, reasons: [], severity: [] }
 */
function analyzeRules(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return {
            score: 100,
            reasons: ['No text provided'],
            severity: []
        };
    }

    const lower = text.toLowerCase();
    let deductions = [];
    const reasons = [];
    const severity = [];

    const lang = (options.lang || 'en').toLowerCase();

    // Tagalog sensational keywords (small curated list)
    const TAGALOG_SENSATIONAL = [
        'nakakagulat', 'huwag', 'huwag palampasin', 'huwag maniwala', 'sikreto', 'patunay', 'dapat malaman', 'bawal', 'babala'
    ];

    // Rule 1: Sensational keywords (highest priority)
    for (const keyword of SENSATIONAL_KEYWORDS) {
        if (lower.includes(keyword)) {
            deductions.push(15);
            reasons.push(`Sensational keyword detected: "${keyword}"`);
            severity.push('high');
            break; // Only penalize once for sensational language
        }
    }

    // Also check Tagalog sensational terms when language is Tagalog or unknown
    if (lang === 'tl' || lang === 'unknown') {
        for (const k of TAGALOG_SENSATIONAL) {
            if (lower.includes(k)) {
                deductions.push(15);
                reasons.push(`Sensational (Tagalog) keyword detected: "${k}"`);
                severity.push('high');
                break;
            }
        }
    }

    // Rule 2: Clickbait patterns
    for (const pattern of CLICKBAIT_PATTERNS) {
        if (pattern.test(text)) {
            deductions.push(12);
            reasons.push('Clickbait pattern detected');
            severity.push('high');
            break;
        }
    }

    // Rule 3: Excessive punctuation
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    
    if (exclamationCount > 3) {
        deductions.push(10);
        reasons.push(`Excessive exclamation marks (${exclamationCount})`);
        severity.push('medium');
    }

    if (questionCount >= 3) {
        deductions.push(8);
        reasons.push(`Excessive question marks (${questionCount})`);
        severity.push('medium');
    }

    // Rule 4: ALL CAPS words (multiple)
    const words = text.split(/\s+/);
    const allCapsWords = words.filter(w => /^[A-Z]{3,}$/.test(w));
    
    if (allCapsWords.length >= 2) {
        deductions.push(10);
        reasons.push(`Multiple ALL CAPS words (${allCapsWords.length})`);
        severity.push('medium');
    }

    // Rule 5: Very short text
    // For Tagalog, allow slightly shorter texts without penalty because many posts are concise
    const shortThreshold = (lang === 'tl') ? 40 : 50;
    if (text.trim().length < shortThreshold) {
        deductions.push(5);
        reasons.push('Text is too short for reliable analysis');
        severity.push('low');
    }

    // Rule 6: Mixed case intensity (alternating caps for emphasis)
    const mixedCaseMatches = (text.match(/[A-Z][a-z]?[A-Z]/g) || []).length;
    if (mixedCaseMatches > 5) {
        deductions.push(8);
        reasons.push('Erratic capitalization pattern');
        severity.push('low');
    }

    // Rule 7: Multiple ellipsis or special punctuation combos
    const suspiciousPunctuation = (text.match(/[!?]{2,}|\.{3,}/g) || []).length;
    if (suspiciousPunctuation > 2) {
        deductions.push(6);
        reasons.push('Suspicious punctuation combinations');
        severity.push('low');
    }

    // Calculate final score
    const totalDeduction = deductions.reduce((a, b) => a + b, 0);
    const score = Math.max(0, Math.min(100, 100 - totalDeduction));

    return {
        score,
        reasons,
        severity,
        deductionTotal: totalDeduction
    };
}

module.exports = {
    analyzeRules,
    SENSATIONAL_KEYWORDS,
    CLICKBAIT_PATTERNS
};
