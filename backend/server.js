const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Import scoring modules
const { analyzeRules } = require('./scoring/rules');
const { getSourceScore, extractDomain } = require('./scoring/sourceChecker');
const { aggregateScores, determineLabel } = require('./scoring/aggregator');
const { generateExplanation, formatForAudience } = require('./scoring/explainer');

const app = express();
const PORT = process.env.PORT || 3000;
const AI_SERVICE_URL = 'http://127.0.0.1:8000/analyze';

// Middlewares
app.use(cors());
app.use(express.json());

// Simple in-memory cache for repeated requests (10 min TTL)
const analysisCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCacheKey(text, url, sourceKey = '') {
    // Create a simple hash of text + url
    return Buffer.from(`${text}|${url}|${sourceKey}`).toString('base64');
}

function getCachedAnalysis(text, url, sourceKey) {
    const key = getCacheKey(text, url, sourceKey);
    const cached = analysisCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }
    
    return null;
}

function cacheAnalysis(text, url, sourceKey, result) {
    const key = getCacheKey(text, url, sourceKey);
    analysisCache.set(key, {
        result,
        timestamp: Date.now()
    });
}

function normalizeSourceInput({ url, source, platform, author, authorUrl }) {
    if (source && typeof source === 'object') {
        return source;
    }

    if (platform === 'facebook' || /facebook\.com|fb\.com/i.test(url || '')) {
        return {
            name: author?.name || author || null,
            url: authorUrl || null,
            platform: 'facebook'
        };
    }

    if (url) {
        return {
            domain: extractDomain(url),
            url,
            platform: platform || 'article'
        };
    }

    return null;
}

function buildSourceKey(source) {
    if (!source) return '';

    return [
        source.platform || '',
        source.name || '',
        source.domain || '',
        source.url || ''
    ].join('|');
}

/**
 * Call Python AI service for ML-based scoring
 */
async function getMLScore(text, lang = 'en') {
    try {
        // Provide language hint to AI service if supported
        const payload = { text };
        if (lang) payload.lang = lang;
        const response = await axios.post(AI_SERVICE_URL, payload, { timeout: 5000 });
        
        return {
            mlScore: (1 - response.data.fake_probability) * 100,
            mlConfidence: response.data.confidence,
            mlFakeProbability: response.data.fake_probability,
            mlExplanation: response.data.explanation || 'ML analysis complete'
        };
    } catch (error) {
        console.error('ML Service error:', error.message);
        
        // Fallback: return neutral ML score
        return {
            mlScore: 50,
            mlConfidence: 0,
            mlFakeProbability: 0.5,
            mlExplanation: 'ML service unavailable - using default score',
            mlError: true
        };
    }
}

// Lightweight language detection (heuristic)
function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'unknown';
    const lower = text.toLowerCase();
    const tagalogHints = [' ang ', ' ng ', ' sa ', ' ay ', ' na ', ' ito ', ' natin ', ' kami ', ' kayo ', ' siya ', ' po ', ' opo ', ' salamat', ' balita', ' mamaya'];
    let hits = 0;
    for (const h of tagalogHints) {
        if (lower.includes(h)) hits += 1;
    }
    if (hits >= 2) return 'tl';
    // basic english detection by common words
    const englishHints = [' the ', ' and ', ' is ', ' are ', ' that ', ' this ', ' with '];
    let ehits = 0;
    for (const h of englishHints) {
        if (lower.includes(h)) ehits += 1;
    }
    if (ehits >= 2) return 'en';
    return 'unknown';
}

/**
 * Main analysis endpoint - Multi-layer hybrid scoring
 */
app.post('/analyze', async (req, res) => {
    try {
        const { text, content, url, source, platform, author, authorUrl } = req.body;

        // Log incoming payload for debugging author forwarding
        console.log('TruthLayer backend: incoming /analyze payload', {
            url: url || null,
            source: source || null,
            platform: platform || null,
            author: author || null,
            authorUrl: authorUrl || null,
            textLength: (text || content || '').length
        });
        const articleText = (text || content || '').trim();
        const sourceInput = normalizeSourceInput({ url, source, platform, author, authorUrl });
        const sourceKey = buildSourceKey(sourceInput);

        if (!articleText) {
            return res.status(400).json({
                error: 'Text or content is required',
                score: null,
                confidence: null
            });
        }

        console.log(`\n📊 TruthLayer: Starting multi-layer analysis`);
        console.log(`   Source: ${url || 'unknown'}`);
        console.log(`   Text length: ${articleText.length} chars`);
        if (sourceInput?.name) {
            console.log(`   Author/Page: ${sourceInput.name}`);
        }

        // Check cache first
        const cached = getCachedAnalysis(articleText, url, sourceKey);
        if (cached) {
            console.log(`   ✓ Cache hit - returning cached result`);
            return res.json(cached);
        }

        // detect language
        const lang = detectLanguage(articleText);

        // ==========================================
        // LAYER 1: Rule-Based Scoring
        // ==========================================
        console.log(`\n   Layer 1: Rule-Based Analysis (lang=${lang})`);
        const ruleAnalysis = analyzeRules(articleText, { lang });
        console.log(`   → Rule score: ${ruleAnalysis.score}/100`);
        console.log(`   → Issues found: ${ruleAnalysis.reasons.length}`);

        // ==========================================
        // LAYER 2: ML-Based Scoring
        // ==========================================
        console.log(`\n   Layer 2: ML Model Prediction (lang=${lang})`);
        const mlResult = await getMLScore(articleText, lang);
        console.log(`   → ML score: ${Math.round(mlResult.mlScore)}/100`);
        console.log(`   → ML confidence: ${(mlResult.mlConfidence * 100).toFixed(1)}%`);

        // ==========================================
        // LAYER 3: Source Credibility
        // ==========================================
        let sourceScore = 50;
        let sourceAnalysis = { reason: 'No source provided', category: 'unknown' };

        if (sourceInput || url) {
            console.log(`\n   Layer 3: Source Credibility Check`);
            sourceAnalysis = getSourceScore(sourceInput || { url, domain: url ? extractDomain(url) : '' });
            sourceScore = sourceAnalysis.score;
            console.log(`   → Source score: ${sourceScore}/100`);
            console.log(`   → Category: ${sourceAnalysis.category}`);
            console.log(`   → Reason: ${sourceAnalysis.reason}`);
        } else {
            console.log(`\n   Layer 3: Source Credibility Check`);
            console.log(`   → Skipped (no URL provided)`);
        }

        // ==========================================
        // LAYER 4: Score Aggregation
        // ==========================================
        console.log(`\n   Layer 4: Score Aggregation`);
        const aggregated = aggregateScores({
            ruleScore: ruleAnalysis.score,
            mlScore: mlResult.mlScore,
            sourceScore: sourceScore,
            mlConfidence: mlResult.mlConfidence
        });

        const finalScore = aggregated.finalScore;

        let finalConfidence = aggregated.confidence;
        const trustedSource = sourceAnalysis.category === 'trusted';
        const suspiciousSource = sourceAnalysis.category === 'suspicious';
        const lowFakeProbability = mlResult.mlFakeProbability <= 0.35;
        const highFakeProbability = mlResult.mlFakeProbability >= 0.65;

        if (trustedSource && lowFakeProbability) {
            finalConfidence = Math.min(1, finalConfidence + 0.1);
        } else if (suspiciousSource && highFakeProbability) {
            finalConfidence = Math.max(0, finalConfidence - 0.1);
        }

        const label = determineLabel(finalScore, finalConfidence);

        console.log(`   → Final score: ${finalScore}/100`);
        console.log(`   → Final confidence: ${(finalConfidence * 100).toFixed(1)}%`);
        console.log(`   → Label: ${label}`);

        // ==========================================
        // LAYER 5: Explainability
        // ==========================================
        console.log(`\n   Layer 5: Generating Explanation`);
        const explanation = generateExplanation({
            finalScore,
            confidence: finalConfidence,
            label,
            breakdown: aggregated.breakdown,
            ruleReasons: ruleAnalysis.reasons,
            mlExplanation: mlResult.mlExplanation,
            sourceReason: sourceAnalysis.reason
        });

        // ==========================================
        // BUILD RESPONSE
        // ==========================================
        const response = {
            score: finalScore,
            confidence: finalConfidence,
            label: label,
            narrative: explanation.narrative,
            reasons: [
                ...ruleAnalysis.reasons,
                mlResult.mlExplanation,
                sourceAnalysis.reason
            ].filter(r => r && r.trim()),
            breakdown: {
                rule: aggregated.breakdown.rule,
                ml: aggregated.breakdown.ml,
                source: aggregated.breakdown.source
            },
            keyFindings: explanation.details
                .flatMap(d => d.findings)
                .slice(0, 3),
            metadata: {
                timestamp: new Date().toISOString(),
                mlAvailable: !mlResult.mlError,
                sourceUrl: url || null,
                sourceType: sourceAnalysis.sourceType || null,
                sourceName: sourceInput?.name || null,
                textLength: articleText.length
            }
        };

        // Cache the result
        cacheAnalysis(articleText, url, sourceKey, response);

        console.log(`\n✅ Analysis complete in Layer 5\n`);
        res.json(response);

    } catch (error) {
        console.error('Backend analysis error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'TruthLayer Backend',
        layers: [
            'Rule-based scoring',
            'ML model prediction',
            'Source credibility',
            'Score aggregation',
            'Explainability engine'
        ]
    });
});

/**
 * Cache statistics endpoint (for debugging)
 */
app.get('/cache-stats', (req, res) => {
    res.json({
        cacheSize: analysisCache.size,
        cacheTTL: `${CACHE_TTL / 1000}s`
    });
});

/**
 * Clear cache endpoint
 */
app.post('/cache-clear', (req, res) => {
    analysisCache.clear();
    res.json({ message: 'Cache cleared', size: 0 });
});

app.listen(PORT, () => {
    console.log(`\n🚀 TruthLayer Backend running on http://localhost:${PORT}`);
    console.log(`📊 Multi-layer scoring system active\n`);
});

