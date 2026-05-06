const DEBUG_MODE = true;
let fbPaused = false;
let cachedDismissedPosts = {}; // Session-only dismissal cache
let postDataMap = {}; // Map post signatures to analysis data
let lastActivePostSignature = null; // Track the most recently interacted post
let pendingShareData = null; // Store analysis data of the post being shared

const SCORE_THRESHOLDS = {
    lowMax: 40,
    highMin: 70
};

// Load initial state
chrome.storage.local.get(["fbPaused"], (data) => {
    fbPaused = !!data.fbPaused;
    if (fbPaused) removeAllPopups();
});

// Sync state
chrome.storage.onChanged.addListener((changes) => {
    if (changes.fbPaused) fbPaused = changes.fbPaused.newValue;
});

// Listen for toggle messages
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE_FB_PAUSE") {
        fbPaused = msg.paused;
        debugLog(`Toggle received: fbPaused = ${fbPaused}`);

        if (fbPaused) {
            removeAllPopups();
        } else {
            debugLog('Resuming TruthLayer: Resetting all UI states.');

            // Clear session-only dismissals on resume
            cachedDismissedPosts = {};

            clearProcessedFlags();
            rehydrateUI();
            initialScan();
            runScan();
        }
    }
});

function rehydrateUI() {
    // Instantly restore full popups from session cache
    const posts = document.querySelectorAll('[data-truthlayer-signature]');
    let rehydratedCount = 0;
    posts.forEach(post => {
        if (post._truthlayerData && !post.querySelector('.truthlayer-floating-popup')) {
            debugLog(`Rehydrating popup for signature: ${post.dataset.truthlayerSignature}`);
            injectBanner(post, post._truthlayerData);
            rehydratedCount++;
        }
    });
    if (rehydratedCount > 0) debugLog(`Successfully re-injected ${rehydratedCount} popups.`);
}

function clearProcessedFlags() {
    // Clear ALL flags to ensure a full re-evaluation
    const elements = document.querySelectorAll('[data-truthlayer-processed], [data-truthlayer-signature], [data-truthlayer-dismissed]');
    debugLog(`Clearing flags on ${elements.length} elements.`);
    elements.forEach(el => {
        delete el.dataset.truthlayerProcessed;
        delete el.dataset.truthlayerSignature;
        delete el.dataset.truthlayerDismissed;
        // Also remove any restore icons as they will be replaced by popups
        el.querySelectorAll('.truthlayer-restore-icon').forEach(icon => icon.remove());
    });
}

function removeAllPopups() {
    debugLog('Pausing: Removing all active popups.');
    document.querySelectorAll('.truthlayer-floating-popup, .truthlayer-restore-icon').forEach(el => el.remove());
}

console.log('[TruthLayer] Content script loaded. Initializing...');

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[TruthLayer Debug]', ...args);
    }
}

function getScoreStage(score) {
    if (typeof score !== 'number') return 'unknown';
    if (score >= SCORE_THRESHOLDS.highMin) return 'high';
    if (score <= SCORE_THRESHOLDS.lowMax) return 'low';
    return 'medium';
}

function getScoreStageLabel(score) {
    const stage = getScoreStage(score);
    if (stage === 'high') return 'Likely Credible';
    if (stage === 'medium') return 'Needs Verification';
    if (stage === 'low') return 'Low Credibility';
    return 'Unable to Verify';
}

function isShareNowTrigger(el) {
    if (!el) return null;

    const control = el.closest ? el.closest('button,[role="button"]') : null;
    if (!control) return null;

    const tag = control.tagName && control.tagName.toLowerCase();
    const aria = (control.getAttribute && control.getAttribute('aria-label')) || '';
    const dataTest = (control.getAttribute && control.getAttribute('data-testid')) || '';
    const txt = (control.textContent || '').trim();

    // Only accept the exact confirmation button inside the share dialog.
    if (tag === 'button' && /^(share now)$/i.test(txt)) return control;

    if (tag === 'div' && /^(share now)$/i.test(txt)) return control;
    if (/^(share now)$/i.test(aria)) return control;
    if (/^(share now)$/i.test(dataTest)) return control;

    return null;
}

function createShareModal(data) {
    const overlay = document.createElement('div');
    overlay.className = 'truthlayer-share-overlay';
    const card = document.createElement('div');
    card.className = 'truthlayer-share-card';

    const reasons = data?.keyRiskIndicators || data?.reasons || [];
    let reasonsHtml = '';

    if (reasons.length > 0) {
        reasonsHtml = reasons.map(r => `
            <li>
                <strong>${r}</strong>
                <div class="muted">TruthLayer Risk Indicator</div>
            </li>
        `).join('');
    } else {
        reasonsHtml = `
            <li>
                <strong>Unusual patterns detected</strong>
                <div class="muted">Analysis suggested caution for this content</div>
            </li>
        `;
    }

    card.innerHTML = `
        <div class="truthlayer-share-icon">⚠️</div>
        <h3>This content may be misleading</h3>
        <p>Consider these factors before sharing:</p>
        <ul class="truthlayer-share-list">
            ${reasonsHtml}
        </ul>
        <div class="truthlayer-share-actions">
            <button class="truthlayer-share-cancel">Cancel</button>
            <button class="truthlayer-share-confirm">Share Anyway</button>
        </div>
    `;

    overlay.appendChild(card);
    return overlay;
}

let pendingShareElement = null;

// Fallback: search page for active posts with credibility data
function findActivePostData() {
    const posts = document.querySelectorAll('[data-truthlayer-signature]');
    for (const post of posts) {
        if (post._truthlayerData) {
            return post._truthlayerData;
        }
    }
    return null;
}

function showModalForElement(el, data = null) {
    // Store the analysis data - use fallback if not provided
    pendingShareData = data !== null ? data : findActivePostData();
    const score = pendingShareData?.credibilityScore ?? pendingShareData?.score ?? null;

    debugLog(`Modal opened with credibility score: ${score}`);

    // Avoid multiple modals
    if (document.querySelector('.truthlayer-share-overlay')) return;

    const modal = createShareModal(pendingShareData);
    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector('.truthlayer-share-cancel');
    const confirmBtn = modal.querySelector('.truthlayer-share-confirm');
    let countdownInterval = null;
    let countdownSeconds = 0;

    function cleanup() {
        try { modal.remove(); } catch (e) { }
        pendingShareElement = null;
        pendingShareData = null;
        document.removeEventListener('keydown', onKeyDown, true);
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    function onKeyDown(ev) {
        if (ev.key === 'Escape') {
            ev.stopPropagation();
            ev.preventDefault();
            cleanup();
        }
    }

    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        // If a countdown is running, cancel the share; otherwise just close
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            // restore UI state
            const countdownEl = modal.querySelector('.truthlayer-countdown');
            if (countdownEl) countdownEl.remove();
            const actions = modal.querySelector('.truthlayer-share-actions');
            if (actions) actions.style.display = '';
            return;
        }
        cleanup();
    });

    confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const score = pendingShareData?.credibilityScore ?? pendingShareData?.score ?? null;
        const stage = getScoreStage(score);
        debugLog(`Share Anyway clicked. Score: ${score}`);

        if (stage === 'high') {
            debugLog(`✓ Share allowed for ${stage} stage post (${score}). No countdown.`);
            if (pendingShareElement) {
                pendingShareElement.dataset.truthlayerBypass = '1';
                try {
                    pendingShareElement.click();
                } catch (err) {
                    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                    pendingShareElement.dispatchEvent(ev);
                }
            }
            cleanup();
            return;
        }

        debugLog(`✗ Low credibility or unknown (${score}). Starting countdown.`);

        // Start a 5-second countdown where the user can cancel
        countdownSeconds = 5;
        const card = modal.querySelector('.truthlayer-share-card');
        const actions = modal.querySelector('.truthlayer-share-actions');
        // Instead of hiding all actions, hide only the confirm button and
        // change the cancel button to a 'Cancel share' action so the user
        // can stop the countdown.
        if (!card) return;

        // Hide confirm; change cancel label
        if (actions) {
            confirmBtn.style.display = 'none';
            cancelBtn.textContent = 'Cancel share';
        }

        // Show full-screen countdown UI with bottom cancel button
        if (!card) return;

        if (actions) {
            confirmBtn.style.display = 'none';
            cancelBtn.textContent = 'Cancel share';
        }

        // hide the original modal while showing the big countdown
        modal.style.display = 'none';

        const fullOverlay = document.createElement('div');
        fullOverlay.className = 'truthlayer-fullcountdown-overlay';
        const fullCard = document.createElement('div');
        fullCard.className = 'truthlayer-fullcountdown-card';
        fullCard.innerHTML = `
            <div class="truthlayer-fullcountdown-title">Sharing in <span class="truthlayer-fullcount-number">${countdownSeconds}</span>...</div>
            <div class="truthlayer-fullcount-sub">Take a moment to verify this information</div>
        `;

        const bottomCancel = document.createElement('button');
        bottomCancel.className = 'truthlayer-countdown-cancel bottom';
        bottomCancel.textContent = 'Cancel';
        fullCard.appendChild(bottomCancel);
        fullOverlay.appendChild(fullCard);
        document.body.appendChild(fullOverlay);

        countdownInterval = setInterval(() => {
            countdownSeconds -= 1;
            const numEl = fullCard.querySelector('.truthlayer-fullcount-number');
            if (numEl) numEl.textContent = String(countdownSeconds);
            if (countdownSeconds <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                // trigger the native share by setting bypass and re-clicking
                if (pendingShareElement) {
                    pendingShareElement.dataset.truthlayerBypass = '1';
                    try {
                        pendingShareElement.click();
                    } catch (err) {
                        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                        pendingShareElement.dispatchEvent(ev);
                    }
                }
                if (fullOverlay && fullOverlay.parentNode) fullOverlay.parentNode.removeChild(fullOverlay);
                cleanup();
            }
        }, 1000);

        // Cancel during countdown: remove full overlay and restore modal
        const cancelDuringCountdownHandler = function (e) {
            if (!countdownInterval) return;
            e.stopPropagation();
            e.preventDefault();
            clearInterval(countdownInterval);
            countdownInterval = null;
            if (fullOverlay && fullOverlay.parentNode) fullOverlay.parentNode.removeChild(fullOverlay);
            // restore modal UI
            modal.style.display = '';
            if (confirmBtn) confirmBtn.style.display = '';
            if (cancelBtn) cancelBtn.textContent = 'Cancel';
        };

        bottomCancel.addEventListener('click', cancelDuringCountdownHandler);
    });

    document.addEventListener('keydown', onKeyDown, true);
}

// Capture which post is being shared
document.addEventListener('click', (ev) => {
    try {
        const target = ev.target;
        if (!target) return;

        // Look for share buttons on posts (before dialog opens)
        const shareBtn = target.closest ? target.closest('button[aria-label*="Share"], [aria-label*="share"]') : null;
        if (!shareBtn) return;

        // Find the post container
        const post = shareBtn.closest('[data-truthlayer-signature]');
        if (post) {
            lastActivePostSignature = post.dataset.truthlayerSignature;
            debugLog(`Tracking post for share: signature=${lastActivePostSignature}`);
        }
    } catch (e) {
        // Silent fail - this is just tracking
    }
}, true);

document.addEventListener('click', (ev) => {
    try {
        // If the click is inside our modal overlay, ignore it so modal buttons work
        if (ev.target && ev.target.closest && ev.target.closest('.truthlayer-share-overlay')) return;

        // Only operate inside the Facebook share dialog itself
        const shareDialog = ev.target && ev.target.closest ? ev.target.closest('[role="dialog"]') : null;
        if (!shareDialog) return;

        const shareEl = isShareNowTrigger(ev.target);
        if (!shareEl) return;

        // If this click was triggered programmatically after confirmation, allow it.
        if (shareEl.dataset && shareEl.dataset.truthlayerBypass === '1') {
            delete shareEl.dataset.truthlayerBypass;
            return; // allow default behavior
        }

        // Get credibility data for the post being shared
        let data = null;
        if (lastActivePostSignature && postDataMap[lastActivePostSignature]) {
            data = postDataMap[lastActivePostSignature];
        }

        // Fallback: if signature lookup failed, try to find the post in the DOM that has data
        if (!data) {
            data = findActivePostData();
            if (data) debugLog('✓ Found post data via DOM fallback');
        }

        const score = data?.credibilityScore ?? data?.score ?? null;

        // NEW LOGIC: Only show modal for MIDDLE risk (40-69) and HIGH risk (<= 40)
        if (score !== null && score < 70) {
            debugLog(`⚠ Intercepting share for risky post (score: ${score})`);

            // Block the native flow and show our modal instead
            ev.stopImmediatePropagation();
            ev.preventDefault();

            pendingShareElement = shareEl;
            showModalForElement(shareEl, data);
        } else if (score === null) {
            debugLog(`⚠ No credibility data found for post. Showing caution modal.`);
            ev.stopImmediatePropagation();
            ev.preventDefault();
            pendingShareElement = shareEl;
            showModalForElement(shareEl, data);
        }
    } catch (err) {
        console.error('TruthLayer share interception error', err);
    }
}, true);

// Listen for "See more" clicks to trigger a re-analysis of the post
document.addEventListener('click', (ev) => {
    try {
        const target = ev.target;
        if (!target) return;

        const targetText = (target.textContent || '').trim();
        const parentText = (target.parentElement?.textContent || '').trim();

        // Match "See more" or "See Translation"
        const isSeeMore = /^(See more|See Translation)$/i.test(targetText) ||
            /^(See more|See Translation)$/i.test(parentText);

        if (isSeeMore) {
            debugLog('"See more/translation" click detected!');

            // Find the most likely post root container
            const postRoot = target.closest('[data-pagelet*="FeedUnit"]') ||
                target.closest('[role="article"]') ||
                target.closest('[data-truthlayer-processed="true"]') ||
                target.closest('[data-truthlayer-signature]');

            if (postRoot) {
                debugLog('Post container captured. Waiting for DOM expansion...');

                // Temporarily mark as "re-processing" to prevent duplicate triggers
                postRoot.dataset.truthlayerReprocessing = "true";

                // Wait for expansion to complete
                setTimeout(async () => {
                    debugLog('Triggering re-analysis after expansion.');

                    // Forcefully clear all TruthLayer flags on this element and children
                    delete postRoot.dataset.truthlayerProcessed;
                    delete postRoot.dataset.truthlayerSignature;
                    delete postRoot.dataset.truthlayerReprocessing;

                    postRoot.querySelectorAll('[data-truthlayer-processed]').forEach(el => {
                        delete el.dataset.truthlayerProcessed;
                    });

                    // Find top container for cleanup
                    const topContainer = postRoot.closest('[data-pagelet*="FeedUnit"], [role="article"]') ||
                        (typeof resolveAuthorSearchRoot === 'function' ? resolveAuthorSearchRoot(postRoot) : postRoot);

                    // Remove existing UI
                    [postRoot, topContainer].forEach(container => {
                        container.querySelectorAll('.truthlayer-floating-popup, .truthlayer-restore-icon, .truthlayer-banner').forEach(el => el.remove());
                    });

                    // Directly call processPost for this specific element
                    if (typeof processPost === 'function') {
                        await processPost(postRoot);
                    } else if (typeof runScan === 'function') {
                        runScan();
                    }
                }, 1200); // 1.2s to be safer for slow connections/expansions
            } else {
                debugLog('Could not find post container for expansion button.');
            }
        }
    } catch (e) {
        console.error('TruthLayer SeeMore listener error:', e);
    }
}, true);

// Function to extract text from a Facebook post element
function extractTextFromPost(postElement) {
    // Facebook feed posts usually put their actual content inside these data attributes
    const messageContainer = postElement.querySelector('div[data-ad-preview="message"], div[data-comet-ad-preview="message"]');

    if (messageContainer) {
        // The actual text is often deeply nested inside divs with text-align styles
        const textDivs = messageContainer.querySelectorAll('div[style*="text-align"]');
        if (textDivs.length > 0) {
            let extractedText = '';
            textDivs.forEach(div => {
                extractedText += div.textContent.trim() + '\n';
            });
            return extractedText.trim();
        }

        // Fallback: just get the text content of the message container
        return messageContainer.textContent.trim();
    }

    // Fallbacks: try other common containers used by Facebook for post text
    const fallbackSelectors = [
        'div[data-testid="post_message"]',
        'div[dir="auto"]',
        'span[dir="auto"]',
        'p',
        'strong',
        'em',
        'a[role="link"] span'
    ];

    let collected = '';
    for (const sel of fallbackSelectors) {
        const nodes = postElement.querySelectorAll(sel);
        nodes.forEach(n => {
            const t = n.textContent.trim();
            if (t && !/^(Like$|Comment$|Share$|See more$|See Translation$|Edited$)/i.test(t)) {
                collected += t + '\n';
            }
        });
        if (collected) break;
    }

    // If still empty, try image alt texts and link titles
    if (!collected) {
        const imgs = postElement.querySelectorAll('img[alt]');
        imgs.forEach(img => {
            if (img.alt && img.alt.trim()) collected += img.alt.trim() + '\n';
        });
    }

    if (collected) return collected.trim();

    // As a last resort, return the post's visible text content (may include UI labels)
    const visible = postElement.textContent ? postElement.textContent.trim() : null;
    return visible || null;
}

// ---------------------------------------------------------------------------
// extractAuthor() — 4-tier page name extraction
//
// Tier 1: data-ad-rendering-role="profile_name"  (Facebook internal semantic marker)
// Tier 2: Heading (<h3>/<h4>) + role="link" anchor
// Tier 3: aria-label="..., view story" on the avatar/story link
// Tier 4: Any facebook.com profile link (broad fallback)
//
// Returns: { name: string, url: string|null, anchorEl: Element|null }
//   anchorEl is passed internally so processPost() can read the verified badge
//   without running a second querySelector pass.
// ---------------------------------------------------------------------------
function extractAuthor(postElement) {
    if (!postElement) return null;

    // ── SCOPE RESOLUTION ────────────────────────────────────────────────────
    // When detectPosts() lands on a message-body element (e.g. the div with
    // data-ad-preview="message"), the header section — which contains
    // profile_name, h3, and the avatar link — is a sibling/ancestor, NOT a
    // descendant.  We therefore walk upward to find the nearest ancestor that
    // actually contains a profile_name div (or any author-bearing structure),
    // giving every tier below a full-post search scope.
    const searchRoot = resolveAuthorSearchRoot(postElement);

    // ── TIER 1: data-ad-rendering-role="profile_name" ───────────────────────
    // Present on both sponsored AND organic posts in the Comet renderer.
    const profileNameDiv = searchRoot.querySelector(
        'div[data-ad-rendering-role="profile_name"]'
    );
    if (profileNameDiv) {
        const anchor = profileNameDiv.querySelector('a[role="link"]') ||
            profileNameDiv.querySelector('a');
        if (anchor) {
            const name = cleanAuthorName(
                anchor.innerText || anchor.textContent || ''
            );
            if (isValidAuthorName(name)) {
                return buildAuthorResult(name, anchor);
            }
        }
    }

    // ── TIER 2 (Organic posts): <strong> / <h2> author link ────────────────
    const organicSelectors = [
        'strong a[role="link"]',
        'strong > a',
        'h2 strong a[role="link"]',
        'h2 strong a',
        'h2 a[role="link"]',
        'h2 a',
    ];
    for (const sel of organicSelectors) {
        const el = searchRoot.querySelector(sel);
        if (!el) continue;
        const name = cleanAuthorName(el.innerText || el.textContent || '');
        if (isValidAuthorName(name)) return buildAuthorResult(name, el);
    }

    // ── TIER 3: h3 / h4 heading-anchored link ──────────────────────────────
    const headingSelectors = [
        'h3 a[role="link"]',
        'h4 a[role="link"]',
        'h3 a',
        'h4 a',
    ];
    for (const sel of headingSelectors) {
        const el = searchRoot.querySelector(sel);
        if (!el) continue;
        const name = cleanAuthorName(el.innerText || el.textContent || '');
        if (isValidAuthorName(name)) return buildAuthorResult(name, el);
    }

    // ── TIER 4: aria-label on avatar / story link ──────────────────────────
    const storyLink = searchRoot.querySelector('a[aria-label*="view story"]');
    if (storyLink) {
        const rawLabel = storyLink.getAttribute('aria-label') || '';
        const name = cleanAuthorName(
            rawLabel.replace(/,?\s*view story$/i, '')
        );
        if (isValidAuthorName(name)) return buildAuthorResult(name, storyLink);
    }

    // ── TIER 5: Any facebook.com profile link (broadest fallback) ──────────
    const fbLinks = searchRoot.querySelectorAll(
        'a[href*="facebook.com/"]:not([href*="facebook.com/l.php"])' +
        ':not([href*="/photo/"]):not([href*="/videos/"]):not([href*="/posts/"])'
    );
    for (const link of fbLinks) {
        const name = cleanAuthorName(link.innerText || link.textContent || '');
        if (isValidAuthorName(name)) return buildAuthorResult(name, link);
    }

    return null;
}

/**
 * Walk upward from the detected post element to find the nearest ancestor
 * that contains a profile_name div (or any author signal).
 *
 * This is necessary because detectPosts() sometimes lands on the message-body
 * container (data-ad-preview="message"), while the author header is a sibling
 * further up the DOM tree.
 *
 * We walk up at most 8 levels to avoid escaping the post boundary.
 */
function resolveAuthorSearchRoot(el) {
    let node = el;
    for (let i = 0; i < 8; i++) {
        if (!node.parentElement) break;
        const parent = node.parentElement;
        // Stop if this ancestor already contains a profile_name or an avatar link
        if (
            parent.querySelector('div[data-ad-rendering-role="profile_name"]') ||
            parent.querySelector('a[aria-label*="view story"]')
        ) {
            return parent;
        }
        node = parent;
    }
    // Fall back to the original element if no wider scope was found
    return el;
}

/**
 * Strip emojis, UI noise, timestamps, and excess whitespace from a candidate
 * page name string so the value passed to the scoring pipeline is clean.
 */
function cleanAuthorName(raw) {
    if (!raw) return '';
    return raw
        // Remove emoji/special Unicode (Emoji ranges)
        .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
        // Strip verified-badge unicode characters Facebook sometimes inlines
        .replace(/[\u2713\u2714\u2705\u2611\u2714\uFE0F]/g, '')
        // Collapse whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Accept a name as a valid page/author name.
 * Rejects UI labels, pure numbers, timestamps, and overly long strings.
 */
function isValidAuthorName(name) {
    if (!name || name.length < 2 || name.length > 80) return false;

    const IGNORE_EXACT = new Set([
        'follow', 'like', 'comment', 'share', 'send', 'reply',
        'sponsored', 'suggested for you', 'public', 'just now',
        'see more', 'see translation', 'edited'
    ]);
    const lower = name.toLowerCase();
    if (IGNORE_EXACT.has(lower)) return false;

    // Reject bare timestamps: "1m", "2h", "3d", "1.2K", "131", etc.
    if (/^\d+(\.\d+)?[smhkKdM]?$/.test(name)) return false;

    return true;
}

/**
 * Build the author result object.
 * anchorEl is kept on the object so the caller can interrogate it
 * (e.g. to check for verified-badge SVG) without a second querySelector.
 */
function buildAuthorResult(name, anchorEl) {
    let url = anchorEl?.getAttribute('href') ||
        anchorEl?.getAttribute('data-href') || null;
    if (url) {
        try { url = new URL(url, window.location.href).href; } catch (e) { url = null; }
    }
    return { name, url, anchorEl };
}

function highlightPost(element, score = 100) {
    if (DEBUG_MODE && element) {
        // Only add border if score is low (HIGH likelihood of being fake)
        if (score <= SCORE_THRESHOLDS.lowMax) {
            element.classList.add('truthlayer-danger-border');
        } else {
            element.classList.remove('truthlayer-danger-border');
        }
        element.style.position = 'relative';

        // Add a debug label if not already present
        if (!element.dataset.truthlayerHighlighted) {
            const label = document.createElement('div');
            label.textContent = 'TL: Post Detected';
            label.style.position = 'absolute';
            label.style.top = '0';
            label.style.right = '0';
            label.style.background = 'red';
            label.style.color = 'white';
            label.style.fontSize = '10px';
            label.style.padding = '2px 4px';
            label.style.zIndex = '9999';
            // element.appendChild(label); // Disabled for cleaner UI but logic remains
            element.dataset.truthlayerHighlighted = 'true';
        }
    }
}

function isValidPost(element) {
    if (!element || element.nodeType !== 1) return false;

    const tag = element.tagName.toLowerCase();
    if (['nav', 'header', 'footer', 'aside', 'form', 'button'].includes(tag)) return false;
    if (element.getAttribute('role') === 'navigation' || element.getAttribute('role') === 'banner') return false;

    const text = element.innerText || element.textContent || '';
    if (text.length < 50) return false;

    return true;
}

function extractPostText(postElement) {
    let extractedText = '';

    // Strategy 0: Facebook's explicit message containers
    const messageContainer = postElement.querySelector('div[data-ad-preview="message"], div[data-comet-ad-preview="message"]');
    if (messageContainer) {
        extractedText = messageContainer.innerText || messageContainer.textContent || '';
    }

    // Strategy 1: Look for div[dir="auto"]
    if (!extractedText || extractedText.length < 20) {
        const textDivs = postElement.querySelectorAll('div[dir="auto"]');
        if (textDivs.length > 0) {
            const textParts = new Set();
            textDivs.forEach(div => {
                const txt = div.innerText?.trim();
                if (txt && txt.length > 0 && (txt.length > 5 || !/^\d+$/.test(txt))) {
                    textParts.add(txt);
                }
            });
            extractedText = Array.from(textParts).join('\n');
        }
    }

    // Strategy 2 (Fallback): use postElement.innerText
    if (!extractedText || extractedText.length < 20) {
        extractedText = postElement.innerText || postElement.textContent || '';
    }

    // Cleaning
    if (extractedText) {
        const uiPhrases = ['Like', 'Comment', 'Share', 'Send', 'Reply', 'Write a comment…', 'Most relevant', 'Top comments'];
        let lines = extractedText.split('\n');
        lines = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !uiPhrases.includes(trimmed);
        });

        const cleanLines = [];
        for (let i = 0; i < lines.length; i++) {
            if (i === 0 || lines[i] !== lines[i - 1]) {
                cleanLines.push(lines[i]);
            }
        }
        extractedText = cleanLines.join('\n').trim();
    }

    return extractedText;
}

function detectPosts(rootNode = document) {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // 1. Block all Messenger domains and paths
    if (host.includes('messenger.com')) return [];
    if (
        path.startsWith('/messages') ||   // /messages, /messages/t/, /messages/e2ee/
        path.startsWith('/t/')            // legacy short messenger path
    ) return [];

    const foundPosts = new Set();

    // 2. Tighter feed-only selectors
    const postSelectors = [
        '[data-pagelet*="FeedUnit"]',
        '[data-pagelet*="GroupFeed"]',
        '[data-pagelet*="ProfileFeed"]',
        '[data-pagelet*="WatchFeed"]',
        '[data-pagelet*="RightRail"]',     // Trending / suggested posts
        '[data-ad-preview="message"]',
        '[data-ad-comet-preview="message"]',
        // Keep role="article" but ONLY when scoped inside a known feed pagelet
        '[data-pagelet*="Feed"] [role="article"]',
        '[data-pagelet*="feed"] [role="article"]',
    ];

    // 2.5 Add permalink-specific selectors if on a single-post page
    // 2.5 Add permalink-specific selectors if on a single-post page
    const isPermalinkPage =
        path.includes('/posts/') ||
        path.includes('/photo') ||
        path.includes('/videos/') ||
        path.includes('/permalink/') ||
        path.includes('/reel/') ||
        window.location.search.includes('fbid=');

    if (isPermalinkPage) {
        postSelectors.push('div[data-pagelet*="permalink"]');
        postSelectors.push('div[data-pagelet*="Permalink"]');
        postSelectors.push('div[data-pagelet*="Media"]');
        postSelectors.push('div[data-pagelet*="Photo"]');
        postSelectors.push('div[data-pagelet*="Biz"]');
        postSelectors.push('div[data-testid="post_message"]');
        postSelectors.push('div[data-ad-preview="message"]');
        postSelectors.push('[aria-posinset]');
        // Add role="article" as a fallback ONLY on permalink pages
        postSelectors.push('[role="article"]');
    }

    // 3. Comprehensive chat/messenger ancestor blocklist
    function isInsideMessagingUI(el) {
        // Fixed-position chat popup boxes Facebook injects at the bottom of the page
        if (el.closest('[data-pagelet="ChatTab"]')) return true;
        if (el.closest('[data-pagelet^="ChatTab"]')) return true;
        if (el.closest('[data-testid="chat_tab"]')) return true;
        if (el.closest('[data-testid="messenger_chat"]')) return true;

        // Messenger drawer / docked chat windows
        if (el.closest('[aria-label="Messenger"]')) return true;
        if (el.closest('[aria-label="Messages"]')) return true;
        if (el.closest('[aria-label="Chat"]')) return true;
        // Only block role="complementary" (sidebars) if it's clearly for messaging
        const comp = el.closest('[role="complementary"]');
        if (comp) {
            const label = (comp.getAttribute('aria-label') || '').toLowerCase();
            if (/\b(chat|message|messenger|conversation|inbox)\b/.test(label)) return true;
            // Otherwise, it might be a post info sidebar on a permalink page, so don't block.
        }

        // Structural: fixed-position containers at the bottom-right are chat boxes
        let node = el;
        while (node && node !== document.body) {
            const style = window.getComputedStyle(node);
            if (style.position === 'fixed') {
                // A fixed element that isn't a full-screen dialog is almost certainly chat
                const rect = node.getBoundingClientRect();
                const isFullScreen =
                    rect.width > window.innerWidth * 0.8 &&
                    rect.height > window.innerHeight * 0.8;
                if (!isFullScreen) return true;
            }
            node = node.parentElement;
        }

        // Aria-label substring checks for comment/reply/message labels
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        if (/\b(chat|message|messenger|conversation|inbox)\b/.test(label)) return true;

        return false;
    }

    function isInsideCommentSection(el) {
        // 1. Explicit comment roles/ids
        if (el.closest('[data-testid*="comment"]')) return true;
        if (el.closest('[data-ad-rendering-role="comment"]')) return true;
        if (el.hasAttribute('data-comment-id')) return true;

        // 2. Comment list containers
        if (el.closest('[data-testid="comment_list"]')) return true;
        if (el.closest('[data-testid="UFI2CommentsList/root_depth_0"]')) return true;
        if (el.closest('[role="list"] [role="article"]')) {
            // If it's an article INSIDE a list, and we are not on the main feed, it's likely a comment
            if (!el.closest('[data-pagelet*="Feed"]')) return true;
        }

        // 3. Sidebars that are not post-specific
        if (el.closest('[role="complementary"]') && !isPermalinkPage) return true;

        // 4. Nested articles 
        // Comments are often articles inside articles, but so are reshared posts.
        // We only block if we are deep inside a list or have explicit comment markers.
        const articleAncestor = el.parentElement?.closest('[role="article"]');
        if (articleAncestor) {
            if (isPermalinkPage) return false;
            // If the ancestor is a feed unit, then this "nested" article is likely the shared content.
            if (articleAncestor.closest('[data-pagelet*="Feed"]')) return false;
            // Otherwise, if it's inside a generic list, it's probably a comment.
            if (el.closest('[role="list"]')) return true;
        }

        // 5. Explicit "Comment" labels
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        if (label.includes('comment') || label.includes('reply')) return true;

        return false;
    }

    postSelectors.forEach(selector => {
        rootNode.querySelectorAll(selector).forEach(el => {
            // Walk up to find the best post-root container
            let container =
                el.closest('[data-pagelet*="FeedUnit"]') ||
                el.closest('[data-pagelet*="GroupFeed"]') ||
                el.closest('[data-pagelet*="ProfileFeed"]') ||
                el.closest('[data-pagelet*="WatchFeed"]') ||
                el.closest('div[data-pagelet*="permalink"]') ||
                el.closest('div[data-pagelet*="Permalink"]') ||
                el.closest('[aria-posinset]') ||
                el.closest('[role="article"]') ||
                el;

            if (!container) return;
            if (container.dataset.truthlayerDismissed === 'true') return;

            // Bail out if inside any messaging surface or comment section
            if (isInsideMessagingUI(container)) return;
            if (isInsideCommentSection(container)) return;

            const text = container.innerText || '';
            // For permalink pages, we are much more lenient with text length
            const minLength = isPermalinkPage ? 20 : 50;
            if (text.length < minLength) return;

            const signature =
                text.length + '_' + text.substring(0, 30).replace(/\s/g, '');

            if (
                container.dataset.truthlayerProcessed === 'true' &&
                container.dataset.truthlayerSignature === signature &&
                container.querySelector('.truthlayer-floating-popup')
            ) return;

            container.dataset.truthlayerSignature = signature;
            foundPosts.add(container);
        });
    });

    const finalPosts = Array.from(foundPosts);
    if (finalPosts.length > 0) debugLog(`Detected ${finalPosts.length} potential posts.`);
    return finalPosts;
}


function injectBanner(postElement, data) {
    if (postElement.dataset.truthlayerDismissed === "true") return;

    console.log('TruthLayer: Injecting banner with data:', data);

    const score = data.credibilityScore !== undefined ? data.credibilityScore : (data.score || 0);
    const label = getScoreStageLabel(score);
    const reasons = data.keyRiskIndicators || data.reasons || [];

    // Apply conditional border logic
    highlightPost(postElement, score);

    let themeClass = 'truthlayer-badge-green';
    let iconClass = 'safe';
    const stage = getScoreStage(score);
    if (stage === 'low') {
        themeClass = 'truthlayer-badge-red';
        iconClass = 'warning';
    } else if (stage === 'medium') {
        themeClass = 'truthlayer-badge-yellow';
        iconClass = 'caution';
    }

    const popup = document.createElement('div');
    popup.className = 'truthlayer-floating-popup';

    const topContainer = postElement.closest('[data-pagelet*="FeedUnit"], [role="article"]') || (typeof resolveAuthorSearchRoot === 'function' ? resolveAuthorSearchRoot(postElement) : postElement);

    // Remove any existing banner or restore icon
    postElement.querySelectorAll('.truthlayer-floating-popup, .truthlayer-restore-icon, .truthlayer-banner').forEach(el => el.remove());
    topContainer.querySelectorAll('.truthlayer-floating-popup, .truthlayer-restore-icon, .truthlayer-banner').forEach(el => el.remove());

    // Save data to element for instant restoration
    postElement._truthlayerData = data;

    // Persist data for share checking
    let signature = postElement.dataset.truthlayerSignature;
    if (!signature) {
        const text = postElement.innerText || "";
        signature = text.length + "_" + text.substring(0, 30).replace(/\s/g, '');
        postElement.dataset.truthlayerSignature = signature;
    }

    // Store analysis data for share checking
    postDataMap[signature] = data;

    // Reasons HTML
    let reasonsHtml = '';
    if (reasons && reasons.length > 0) {
        reasonsHtml = `
            <div class="truthlayer-popup-expandable">
                <ul>
                    ${reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        reasonsHtml = `
            <div class="truthlayer-popup-expandable">
                <p style="margin: 0; padding-left: 10px;">No significant risks detected.</p>
            </div>
        `;
    }

    popup.innerHTML = `
        <div class="truthlayer-popup-close">×</div>
        <div class="truthlayer-popup-header">
            <svg class="truthlayer-popup-icon ${iconClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="truthlayer-popup-score-text">Credibility Score: ${score}</span>
        </div>
        <div class="truthlayer-popup-badge ${themeClass}">
            ${label}
        </div>
        <div class="truthlayer-popup-actions">
            <button class="truthlayer-popup-btn truthlayer-btn-why">Why?</button>
        </div>
        ${reasonsHtml}
    `;

    const btnClose = popup.querySelector('.truthlayer-popup-close');
    const btnWhy = popup.querySelector('.truthlayer-btn-why');
    const expandable = popup.querySelector('.truthlayer-popup-expandable');

    btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        debugLog(`Popup closed via X for signature: ${signature}. Session dismissal only.`);
        popup.remove();
        postElement.classList.remove('truthlayer-danger-border');
        postElement.dataset.truthlayerDismissed = "true";

        // Track in-memory ONLY for current page session
        cachedDismissedPosts[signature] = data;

        injectRestoreIcon(postElement, data);
    });

    btnWhy.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (expandable.classList.contains('open')) {
            expandable.classList.remove('open');
            btnWhy.textContent = 'Why?';
        } else {
            expandable.classList.add('open');
            btnWhy.textContent = 'Hide';
        }
    });



    // Inject into DOM
    topContainer.appendChild(popup);

    const currentPosition = window.getComputedStyle(topContainer).position;
    if (!currentPosition || currentPosition === 'static') {
        topContainer.style.position = 'relative';
    }
    debugLog('Popup successfully injected into post element.');
}

function getRestoreIconVariant(score) {
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) return 'truthlayer-restore-unknown';
    if (numericScore >= SCORE_THRESHOLDS.highMin) return 'truthlayer-restore-high';
    if (numericScore > SCORE_THRESHOLDS.lowMax) return 'truthlayer-restore-medium';
    return 'truthlayer-restore-low';
}

function getRestoreIconVariantFromData(data) {
    const score = data?.credibilityScore ?? data?.score ?? null;

    // Score is the source of truth for UI state. Only fall back to labels if score is missing.
    if (score !== null && score !== undefined && score !== '') {
        return getRestoreIconVariant(score);
    }

    const classification = String(data?.classification || data?.label || '').toLowerCase();
    if (classification.includes('likely credible') || classification === 'credible' || classification.includes('low risk')) {
        return 'truthlayer-restore-high';
    }
    if (classification.includes('needs verification') || classification.includes('medium risk') || classification.includes('somewhat credible') || classification.includes('somewhat')) {
        return 'truthlayer-restore-medium';
    }
    if (classification.includes('low credibility') || classification.includes('high risk') || classification.includes('critical risk') || classification.includes('questionable') || classification.includes('misinformation') || classification.includes('unable')) {
        return 'truthlayer-restore-low';
    }
    return 'truthlayer-restore-unknown';
}

function injectRestoreIcon(postElement, data) {
    const topContainer = postElement.closest('[data-pagelet*="FeedUnit"], [role="article"]') || (typeof resolveAuthorSearchRoot === 'function' ? resolveAuthorSearchRoot(postElement) : postElement);

    // Remove any existing
    const existing = topContainer.querySelector('.truthlayer-restore-icon') || postElement.querySelector('.truthlayer-restore-icon');
    if (existing) existing.remove();

    const score = data?.credibilityScore ?? data?.score ?? null;
    
    // Save data to element for instant restoration
    postElement._truthlayerData = data;

    // Persist data for share checking
    let signature = postElement.dataset.truthlayerSignature;
    if (!signature) {
        const text = postElement.innerText || "";
        signature = text.length + "_" + text.substring(0, 30).replace(/\s/g, '');
        postElement.dataset.truthlayerSignature = signature;
    }

    // Store analysis data for share checking
    postDataMap[signature] = data;

    const icon = document.createElement('div');
    icon.className = `truthlayer-restore-icon ${getRestoreIconVariantFromData(data)}`;
    icon.innerHTML = 'ⓘ';
    icon.title = typeof score === 'number'
        ? `Restore TruthLayer Analysis (${score})`
        : 'Restore TruthLayer Analysis';

    icon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        icon.remove();

        // Clear dismissal state on the element so it can be re-processed
        delete postElement.dataset.truthlayerDismissed;

        // Remove from dismissed storage
        const text = postElement.innerText || "";
        const signature = text.length + "_" + text.substring(0, 30).replace(/\s/g, '');
        chrome.storage.local.get("dismissedPosts", (res) => {
            const dismissed = res.dismissedPosts || {};
            delete dismissed[signature];
            chrome.storage.local.set({ dismissedPosts: dismissed });
        });

        injectBanner(postElement, data);
    });

    topContainer.appendChild(icon);

    const currentPosition = window.getComputedStyle(topContainer).position;
    if (!currentPosition || currentPosition === 'static') {
        topContainer.style.position = 'relative';
    }
}

function getDefaultAnalysis(text, errorMsg) {
    return {
        score: 50,
        label: "Unable to Verify",
        reasons: ["Error: " + (errorMsg || "Could not analyze content.")]
    };
}


async function processPost(postElement) {
    if (fbPaused) return;

    if (postElement.dataset.truthlayerProcessed === "true") {
        // If already processed but has no UI, check if it's because it was dismissed
        const text = postElement.innerText || "";
        const signature = text.length + "_" + text.substring(0, 30).replace(/\s/g, '');

        if (cachedDismissedPosts[signature] && !postElement.querySelector('.truthlayer-restore-icon')) {
            injectRestoreIcon(postElement, cachedDismissedPosts[signature]);
        }
        return;
    }

    let text = extractTextFromPost(postElement);
    const author = extractAuthor(postElement);

    if (!text || text.length < 20) {
        debugLog('Found post but text too short or empty. Length:', text ? text.length : 0);
        return;
    }

    // Mark as processed immediately to avoid duplicate network calls
    postElement.dataset.truthlayerProcessed = "true";
    const signature = text.length + "_" + text.substring(0, 30).replace(/\s/g, '');
    postElement.dataset.truthlayerSignature = signature;

    debugLog('Processing post. Extracted text length:', text.length);
    highlightPost(postElement);

    console.log('TruthLayer sending text for validation:', text);
    if (author) {
        console.log('TruthLayer detected author/page:', author.name, author.url || 'no url');
    }

    // Determine verified status from the anchor element already found by
    // extractAuthor() — avoids a redundant querySelector pass on the post.
    // Falls back to a broad SVG title search if the anchor is unavailable.
    const verifiedBadgeInAnchor = author?.anchorEl
        ? !!author.anchorEl.closest('[data-ad-rendering-role="profile_name"]')
            ?.querySelector('svg[title="Verified account"], svg[aria-label="Verified account"]')
        : false;
    const verifiedBadgeFallback = !verifiedBadgeInAnchor && (
        !!postElement.querySelector(
            'div[data-ad-rendering-role="profile_name"] svg[title="Verified account"],' +
            'div[data-ad-rendering-role="profile_name"] svg[aria-label="Verified account"]'
        )
    );
    const isVerified = verifiedBadgeInAnchor || verifiedBadgeFallback;

    try {
        chrome.runtime.sendMessage({
            type: 'ANALYZE_CONTENT',
            content: text,
            url: window.location.href,
            platform: 'facebook',
            // Strip anchorEl before sending — DOM elements cannot be serialised
            // across the extension messaging boundary.
            author: author ? { name: author.name, url: author.url } : null,
            source: author ? {
                name: author.name,
                url: author.url,
                platform: 'facebook',
                isVerified
            } : {
                url: window.location.href,
                platform: 'facebook'
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message;
                if (errorMsg.includes('context invalidated')) {
                    console.log('TruthLayer: Extension context invalidated. Please refresh the page.');
                    return;
                }
                console.error('TruthLayer: Runtime error', errorMsg);
                injectBanner(postElement, getDefaultAnalysis(text, errorMsg));
                return;
            }
            if (response && response.success) {
                console.log('TruthLayer: Analysis received successfully:', response.data);

                // If score < 70, auto-show the popup.
                // If score >= 70, show only a small info icon (manual access).
                const score = response.data.score ?? response.data.credibilityScore ?? 100;
                if (score < 70) {
                    injectBanner(postElement, response.data);
                } else {
                    debugLog(`Post is credible (score: ${score}). Showing minimal indicator.`);
                    injectRestoreIcon(postElement, response.data);
                }
                // Mark as processed to avoid re-scanning
                postElement.dataset.truthlayerProcessed = "true";
            } else {
                console.error('TruthLayer: Backend error', response?.error);
                injectBanner(postElement, getDefaultAnalysis(text, response?.error));
            }
        });
    } catch (error) {
        if (!error.message.includes('context invalidated')) {
            console.error('TruthLayer: Extension communication error', error);
            injectBanner(postElement, getDefaultAnalysis(text, error?.message));
        }
    }
}


function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
const runScan = debounce(async () => {
    if (fbPaused) {
        debugLog('Scan skipped: Extension is paused.');
        return;
    }
    debugLog('Running batched DOM scan...');
    const posts = detectPosts();
    debugLog(`Found ${posts.length} potential posts to process.`);

    let count = 0;
    for (const post of posts) {
        await processPost(post);
        count++;
    }
    if (count > 0) debugLog(`Re-processed ${count} posts.`);
}, 500);

function observeDOM() {
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    if (mutation.addedNodes[i].nodeType === 1) {
                        shouldScan = true;
                        break;
                    }
                }
            }
            if (shouldScan) break;
        }

        if (shouldScan) {
            runScan();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

console.log("[TruthLayer] State reset: New page session detected.");

function initialScan() {
    const posts = detectPosts();
    debugLog(`Initial scan: Reprocessing ${posts.length} visible posts.`);

    posts.forEach(processPost);
}

function periodicRescan() {
    setInterval(() => {
        const posts = detectPosts();
        posts.forEach(processPost);
    }, 1500);
}

// Initialize
initialScan();
observeDOM();
periodicRescan();
