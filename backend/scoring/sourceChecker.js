/**
 * Source Credibility Checker
 *
 * Supports two lightweight modes:
 * - Article/domain scoring using the URL domain
 * - Social page scoring using { name, url } for Facebook posts
 */

const TRUSTED_DOMAINS = [
    // Major international wire services
    'reuters.com', 'reuters.tv',
    'apnews.com',

    // UK / European broadcasters & press
    'bbc.com', 'bbc.co.uk',
    'theguardian.com',
    'ft.com',
    'economist.com',
    'telegraph.co.uk',
    'independent.co.uk',
    'euronews.com',
    'dw.com',

    // US major outlets
    'nytimes.com',
    'washingtonpost.com',
    'wsj.com',
    'npr.org',
    'cnn.com',
    'nbcnews.com',
    'cbsnews.com',
    'abcnews.go.com',
    'usatoday.com',
    'bloomberg.com',
    'time.com',
    'theatlantic.com',
    'vox.com',
    'politico.com',
    'axios.com',
    'propublica.org',
    'csmonitor.com',
    'pbs.org',

    // Fact-checkers
    'politifact.com',
    'snopes.com',
    'factcheck.org',
    'fullfact.org',
    'africacheck.org',
    'checkyourfact.com',
    'vera-files.org',

    // Middle East / Asia-Pacific
    'aljazeera.com',
    'aljazeera.net',
    'straitstimes.com',
    'scmp.com',                  // South China Morning Post
    'channelnewsasia.com',
    'bangkokpost.com',
    'asahi.com',

    // Philippine government / official
    'pna.gov.ph',
    'pcoo.gov.ph',
    'gov.ph',
    'senate.gov.ph',
    'congress.gov.ph',
    'doh.gov.ph',
    'neda.gov.ph',
    'bsp.gov.ph',

    // Academic / science / tech
    'nature.com',
    'science.org',
    'sciencenews.org',
    'thelancet.com',
    'nejm.org',
    'jamanetwork.com',
    'pubmed.ncbi.nlm.nih.gov',
    'who.int',
    'un.org',
    'unicef.org',
    'worldbank.org',
    'imf.org',
    'ieee.org',
    'acm.org',
    'scholar.google.com',
    'github.com',
    'stackoverflow.com',
    'wikipedia.org',

    "rappler.com",
    "inquirer.net",
    "philstar.com",
    "manilatimes.net",
    "manilabulletin.com",
    "businessmirror.com.ph",
    "bworldonline.com",
    "cnnphilippines.com",
    "abs-cbn.com",
    "gmanetwork.com",

    "verafiles.org",
    "pcij.org",

    "up.edu.ph",
    "ateneo.edu",
    "dlsu.edu.ph",
    "ust.edu.ph",

    "reuters.com",
    "bbc.com",
    "aljazeera.com"
];


const TRUSTED_PAGES = [
    // ── Wire services ──────────────────────────────────────────────────────
    'reuters', 'reuters news',
    'ap', 'ap news', 'associated press',
    'afp', 'agence france-presse',

    // ── UK / European ──────────────────────────────────────────────────────
    'bbc', 'bbc news', 'bbc world service',
    'the guardian', 'guardian news',
    'financial times',
    'the economist',
    'euronews',
    'dw news', 'deutsche welle',
    'sky news',
    'channel 4 news',
    'the telegraph',
    'the independent',

    // ── US major outlets ───────────────────────────────────────────────────
    'cnn', 'cnn breaking news',
    'new york times', 'the new york times', 'nytimes',
    'washington post', 'the washington post',
    'wall street journal', 'the wall street journal', 'wsj',
    'npr', 'npr news',
    'nbc news',
    'cbs news',
    'abc news',
    'pbs newshour',
    'usa today',
    'bloomberg', 'bloomberg news',
    'time', 'time magazine',
    'the atlantic',
    'vox',
    'politico',
    'axios',
    'propublica',
    'the hill',
    'christian science monitor',

    // ── Middle East / Asia-Pacific ─────────────────────────────────────────
    'al jazeera', 'al jazeera english',
    'al jazeera arabic',
    'channel news asia', 'cna',
    'south china morning post', 'scmp',
    'straits times',
    'japan times',
    'the hindu',
    'dawn',                          // Pakistan
    'bangkok post',

    // ── Philippine news (primary outlets) ─────────────────────────────────
    'gma news', 'gma news online', 'gma network',
    'abs-cbn news', 'abscbn news', 'abs-cbn',
    'cnn philippines',
    'one news', 'one news ph',
    'tv5 news', 'tv5',
    'news5',
    'dzrh news', 'dzrh',
    'manila bulletin',
    'manila times', 'the manila times',
    'philippine daily inquirer', 'inquirer', 'inquirer.net',
    'philstar', 'philstar global', 'the philippine star',
    'rappler',
    'vera files', 'vera files fact check',
    'interaksyon',
    'sunstar',
    'businessworld', 'bw businessworld',
    'business mirror',
    'pna', 'philippine news agency',
    'pcoo',
    'the manila times',
    'mindanews',
    'sunstar cebu', 'sunstar davao',
    'mb', 'manila bulletin news',
    'esquiremag.ph',

    // ── Fact-checking organizations ────────────────────────────────────────
    'politifact',
    'snopes',
    'factcheck.org',
    'full fact',
    'africa check',
    'tsek.ph',
    'check your fact',
    'verafiles',
    'cnn fact check',
    'ap fact check',

    // ── Government / Official institutions ─────────────────────────────────
    'who', 'world health organization',
    'un', 'united nations',
    'unicef',
    'world bank',
    'imf',
    'doh philippines', 'department of health',
    'psa', 'philippine statistics authority',
    'neda',
    'bsp', 'bangko sentral ng pilipinas',
    'senate of the philippines', 'philippine senate',
    'house of representatives',

    // ── Generic trust signals ──────────────────────────────────────────────
    'official news',
    'official page',
    'official account',
    'press office',
    'newsroom'
];

const TRUSTED_PAGE_HANDLES = [
    // Philippine handles
    'gmanews',
    'abscbnnews',
    'abscbn',
    'dzrhnews',
    'manilabulletin',
    'inquirerdotnet',
    'philstarnews',
    'philstar',
    'rapplerdotcom',
    'rappler',
    'onenewsph',
    'cnnphilippines',
    'tv5news',
    'news5everywhere',
    'verafiles',
    'mindanews',
    'pnagovph',
    'sunstarpublication',
    'businessworldph',
    'businessmirror',
    'manilastandardnews',
    'manilatimes',
    // International handles
    'nytimes',
    'wsj',
    'bbcnews',
    'bbcworld',
    'reuters',
    'apnews',
    'cnn',
    'cnni',
    'nbcnews',
    'cbsnews',
    'abcnews',
    'pbsnewshour',
    'usatoday',
    'bloomberg',
    'bloombergnews',
    'aljazeera',
    'aljazeeraenglish',
    'channelnewsasia',
    'scmpnews',
    'theatlantic',
    'voxdotcom',
    'politico',
    'axios',
    'propublica',
    'theguardian',
    'financialtimes',
    'theeconomist',
    'euronews',
    'dwnews',
    'skynews',
    'politifact',
    'snopes',
    'time',
    'npr',
    'whonotfake',
    'unitednations',
    'unicef',
    'whocovid19'
];

const SUSPICIOUS_PAGES = [
    // Content-quality red flags
    'viral',
    'clickbait',
    'must watch',
    'must share',
    'share now',
    'share before deleted',
    'breaking now',
    'you won\'t believe',
    'they don\'t want you to know',
    'suppressed',
    'leaked',
    'exposed',
    'shocking',
    'bombshell',
    // Source-type red flags
    'unofficial',
    'fan page',
    'fan account',
    'parody',
    'satire',                        // not always fake, but warrants review
    // Scam / giveaway
    'giveaway',
    'scam',
    'free iphone',
    'free money',
    // Conspiracy / disinfo markers
    'truth alert',
    'fake news media',
    'mainstream media lies',
    'deep state',
    'new world order',
    'great reset',
    'plandemic',
    'truther',
    'alternative facts',
    'real truth',
    'hidden truth',
    'wake up',
    'sheep',
    'sheeple',
    'agenda',
    'controlled media',
    'censored news'
];

const SUSPICIOUS_DOMAINS = [
    // URL shorteners (hide actual destination)
    'bit.ly', 'tinyurl.com', 'short.url', 'rebrand.ly', 'ow.ly', 'buff.ly',
    't.co', 'goo.gl', 'is.gd', 'v.gd', 'bit.do', 'cutt.ly',
    // Generic unverified blog/site builders
    'blogspot.com', 'wordpress.com',
    'weebly.com', 'wix.com', 'squarespace.com',
    'sites.google.com',
    'medium.com',                    // not inherently bad, but unverified authors
    'substack.com',                  // same: author-level, not org-level
    // Known misinformation-adjacent hosting
    'infowars.com',
    'naturalnews.com',
    'beforeitsnews.com',
    'yournewswire.com',
    'newslo.com',
    'worldnewsdailyreport.com',
    'empirenews.net',
    'theonion.com',                  // satire — flag for review
    'clickhole.com',                 // satire
    // Suspicious structural patterns handled separately via SUSPICIOUS_PATTERNS
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

/**
 * Clean a raw Facebook page name before feeding it into trust lookups.
 * Removes:
 *  - Emoji and Unicode symbol blocks
 *  - Inline verified-badge characters (✓ ✔ ✅)
 *  - Surrounding whitespace and collapse internal whitespace
 *
 * @param {string} raw - Raw page name from the DOM
 * @returns {string} Sanitised page name
 */
function cleanPageName(raw) {
    if (!raw) return '';
    return String(raw)
        // Extended emoji range
        .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
        // Common verification / checkmark symbols
        .replace(/[\u2713\u2714\u2705\u2611\uFE0F]/g, '')
        // Collapse runs of whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

function extractFacebookHandle(url) {
    if (!url) return '';
    try {
        const u = new URL(url.startsWith('http') ? url : 'https://' + url);
        const path = u.pathname || '/';
        const segments = path.split('/').filter(Boolean);

        // Handle profile.php?id=...
        if (segments[0] === 'profile.php') {
            const id = u.searchParams.get('id');
            return id ? `id-${id}` : '';
        }

        // Handle pages/Name/ID
        if (segments[0] === 'pages' && segments[1]) {
            return segments[1].toLowerCase();
        }

        // Handle groups/Name
        if (segments[0] === 'groups' && segments[1]) {
            return segments[1].toLowerCase();
        }

        // Default: first segment is usually the handle
        const handle = segments[0] || '';
        const normalizedHandle = handle.toLowerCase().replace(/[^a-z0-9._-]/g, '');

        const genericPaths = ['search', 'stories', 'posts', 'groups', 'pages', 'videos', 'reels', 'events', 'marketplace'];
        if (genericPaths.includes(normalizedHandle)) return '';

        return normalizedHandle;
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
    // Clean the raw name first so emoji/badge symbols don't break lookups
    const rawName = String(source?.name || '').trim();
    const name = cleanPageName(rawName) || rawName; // fallback to raw if cleaner empties it
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

    // High confidence for verified pages
    if (source.isVerified) {
        return {
            score: 95,
            reason: `Post comes from a verified Facebook page: ${name}`,
            category: 'trusted',
            name,
            url: url || null,
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
    cleanPageName,
    scoreFacebookSource,
    scoreDomainSource,
    TRUSTED_DOMAINS,
    TRUSTED_PAGES,
    SUSPICIOUS_DOMAINS
};
