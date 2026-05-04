/**
 * Source Credibility Checker
 *
 * Supports two lightweight modes:
 * - Article/domain scoring using the URL domain
 * - Social page scoring using { name, url } for Facebook posts
 */

const TRUSTED_DOMAINS = [
    'bbc.com', 'bbc.co.uk',
    'reuters.com', 'reuters.tv',
    'apnews.com',
    'theguardian.com',
    'nytimes.com',
    'washingtonpost.com',
    'ft.com', 'financial times',
    'economist.com',
    'cnn.com',
    'bbc', 'npr.org',
    'csmonitor.com',
    'politifact.com',
    'snopes.com',
    'factcheck.org',
    'sciencenews.org',
    'nature.com',
    'science.org',
    'ieee.org',
    'github.com',
    'stackoverflow.com',
    'wikipedia.org'
];

const TRUSTED_PAGES = [
    'bbc',
    'bbc news',
    'reuters',
    'ap',
    'ap news',
    'associated press',
    'the guardian',
    'guardian news',
    'new york times',
    'nytimes',
    'washington post',
    'wall street journal',
    'wsj',
    'npr',
    'cnn',
    'gma news',
    'abs-cbn news',
    'dzrh news',
    'manila bulletin',
    'philippine daily inquirer',
    'inquirer',
    'philstar',
    'rappler',
    'one news',
    'official news',
    'official page'
];

const TRUSTED_PAGE_HANDLES = [
    'gmanews',
    'abscbnnews',
    'dzrhnews',
    'manilabulletin',
    'inquirerdotnet',
    'philstarnews',
    'rapplerdotcom',
    'onenewsph',
    'nytimes',
    'wsj',
    'bbcnews',
    'reuters',
    'apnews'
];

const SUSPICIOUS_PAGES = [
    'viral',
    'clickbait',
    'unofficial',
    'fan page',
    'truth alert',
    'breaking now',
    'fake news',
    'exposed',
    'shocking',
    'giveaway',
    'scam'
];

const SUSPICIOUS_DOMAINS = [
    'bit.ly', 'tinyurl', 'short.url', // URL shorteners often hide destination
    'blogspot', 'wordpress.com', // Generic blog platforms (not inherently suspicious but less verified)
    'weebly', 'wix.com',
    'patreon.com/donate', // Ad-heavy
];

const SUSPICIOUS_PATTERNS = [
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP address instead of domain
    /\w+\d{10,}/, // Domain with long number string
    /\w{20,}/, // Excessively long domain name
];

/**
 * Extract domain from URL
 * @param {string} url - URL to parse
 * @returns {string} Domain name
 */
function extractDomain(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url);
        return urlObj.hostname.toLowerCase().replace('www.', '');
    } catch (e) {
        return url.toLowerCase().replace('www.', '');
    }
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/https?:\/\//g, '')
        .replace(/^www\./, '')
        .trim();
}

function extractFacebookHandle(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        const firstSegment = (u.pathname || '/').split('/').filter(Boolean)[0] || '';
        return firstSegment.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    } catch (e) {
        return '';
    }
}

/**
 * Check if domain is trusted
 * @param {string} domain - Domain to check
 * @returns {boolean}
 */
function isTrustedDomain(domain) {
    if (!domain) return false;
    return TRUSTED_DOMAINS.some(trusted => 
        domain.includes(trusted) || trusted.includes(domain)
    );
}

/**
 * Check if domain is suspicious
 * @param {string} domain - Domain to check
 * @returns {boolean}
 */
function isSuspiciousDomain(domain) {
    if (!domain) return false;
    
    // Check suspicious domain list
    if (SUSPICIOUS_DOMAINS.some(susp => domain.includes(susp))) {
        return true;
    }
    
    // Check suspicious patterns
    if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(domain))) {
        return true;
    }
    
    return false;
}

function isFacebookSource(source) {
    const domain = source?.domain ? extractDomain(source.domain) : extractDomain(source?.url);
    if (source?.platform && String(source.platform).toLowerCase() === 'facebook') {
        return true;
    }
    return domain.includes('facebook.com') || domain.includes('fb.com');
}

function isTrustedPage(pageName) {
    const normalized = normalizeText(pageName);
    return TRUSTED_PAGES.some(entry => normalized.includes(entry));
}

function isSuspiciousPage(pageName) {
    const normalized = normalizeText(pageName);
    return SUSPICIOUS_PAGES.some(entry => normalized.includes(entry));
}

function scoreDomainSource(urlOrDomain) {
    const domain = extractDomain(urlOrDomain);

    if (!domain) {
        return {
            score: 40,
            reason: 'Invalid URL format',
            category: 'invalid',
            sourceType: 'domain'
        };
    }

    if (isTrustedDomain(domain)) {
        return {
            score: 90,
            reason: `Source is from trusted publication: ${domain}`,
            category: 'trusted',
            domain,
            sourceType: 'domain'
        };
    }

    if (isSuspiciousDomain(domain)) {
        return {
            score: 30,
            reason: `Source shows suspicious characteristics: ${domain}`,
            category: 'suspicious',
            domain,
            sourceType: 'domain'
        };
    }

    return {
        score: 55,
        reason: `Source domain is unverified: ${domain}`,
        category: 'unverified',
        domain,
        sourceType: 'domain'
    };
}

function scoreFacebookSource(source) {
    const name = String(source?.name || '').trim();
    const url = String(source?.url || '').trim();
    const normalizedName = normalizeText(name);
    const pageHandle = extractFacebookHandle(url);

    if (!name && !url) {
        return {
            score: 50,
            reason: 'No Facebook page information provided',
            category: 'unknown',
            sourceType: 'facebook'
        };
    }

    if (isTrustedPage(normalizedName) || TRUSTED_PAGE_HANDLES.includes(pageHandle)) {
        return {
            score: 88,
            reason: `Post comes from a known trusted Facebook page: ${name}`,
            category: 'trusted',
            name,
            url: url || null,
            sourceType: 'facebook'
        };
    }

    if (isSuspiciousPage(normalizedName)) {
        return {
            score: 25,
            reason: `Page name suggests unofficial or viral content: ${name}`,
            category: 'suspicious',
            name,
            url: url || null,
            sourceType: 'facebook'
        };
    }

    if (/\b(news|official)\b/i.test(name) || /news|official/i.test(pageHandle)) {
        return {
            score: 72,
            reason: `Page name suggests a news or official source: ${name}`,
            category: 'likely_trusted',
            name,
            url: url || null,
            sourceType: 'facebook'
        };
    }

    return {
        score: 50,
        reason: `Post comes from an unverified Facebook page: ${name || 'unknown page'}`,
        category: 'unverified',
        name: name || null,
        url: url || null,
        sourceType: 'facebook'
    };
}

/**
 * Get a credibility score for either a domain or a social source object.
 *
 * @param {Object} source
 * @returns {{ score: number, reason: string, category: string, sourceType: string }}
 */
function getSourceScore(source) {
    if (!source || typeof source !== 'object') {
        return {
            score: 50,
            reason: 'No source information provided',
            category: 'unknown',
            sourceType: 'unknown'
        };
    }

    if (source.name || isFacebookSource(source)) {
        return scoreFacebookSource(source);
    }

    if (source.domain) {
        return scoreDomainSource(source.domain);
    }

    if (source.url) {
        return scoreDomainSource(source.url);
    }

    return {
        score: 50,
        reason: 'No recognizable source information provided',
        category: 'unknown',
        sourceType: 'unknown'
    };
}

/**
 * Analyze source/domain credibility
 * @param {string} url - Source URL
 * @returns {Object} { score: 0-100, reason: string, category: string }
 */
function analyzeSource(url) {
    return getSourceScore({ url, domain: extractDomain(url) });
}

module.exports = {
    getSourceScore,
    analyzeSource,
    extractDomain,
    isTrustedDomain,
    isSuspiciousDomain,
    isTrustedPage,
    isSuspiciousPage,
    scoreFacebookSource,
    scoreDomainSource,
    TRUSTED_DOMAINS,
    TRUSTED_PAGES,
    SUSPICIOUS_DOMAINS
};
