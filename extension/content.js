const DEBUG_MODE = true;

function debugLog(...args) {
    if (DEBUG_MODE) {
        //console.log('[TruthLayer Debug]', ...args);
    }
}

// Minimal content script: intercept Share clicks, block the native flow,
// and force a modal to appear on every share. The modal blocks until the
// user chooses an action. On "Share Anyway" we re-dispatch the click and
// allow the original behavior to proceed.

console.log('TruthLayer share-only content script loaded.');

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

function createShareModal() {
    const overlay = document.createElement('div');
    overlay.className = 'truthlayer-share-overlay';
    const card = document.createElement('div');
    card.className = 'truthlayer-share-card';
    card.innerHTML = `
        <div class="truthlayer-share-icon">⚠️</div>
        <h3>This content may be misleading</h3>
        <p>Consider these factors before sharing:</p>
        <ul class="truthlayer-share-list">
            <li><strong>High viral potential</strong><div class="muted">Could reach many people quickly</div></li>
            <li><strong>Emotional manipulation</strong><div class="muted">Uses triggering language and urgency</div></li>
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

function showModalForElement(el) {
    // Avoid multiple modals
    if (document.querySelector('.truthlayer-share-overlay')) return;

    const modal = createShareModal();
    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector('.truthlayer-share-cancel');
    const confirmBtn = modal.querySelector('.truthlayer-share-confirm');
    let countdownInterval = null;
    let countdownSeconds = 0;

    function cleanup() {
        try { modal.remove(); } catch (e) { }
        pendingShareElement = null;
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

        // Block the native flow and show our modal instead
        ev.stopImmediatePropagation();
        ev.preventDefault();

        pendingShareElement = shareEl;
        showModalForElement(shareEl);
    } catch (err) {
        console.error('TruthLayer share interception error', err);
    }
}, true);

// Listen for "See more" clicks to trigger a re-analysis of the post
document.addEventListener('click', (ev) => {
    try {
        const target = ev.target;
        if (!target) return;

        const text = (target.textContent || '').trim().toLowerCase();
        
        if (text === 'see more' || target.innerText?.toLowerCase().trim() === 'see more') {
            console.log('TruthLayer: "See more" click detected!');
            
            // CRITICAL: Find the post container IMMEDIATELY. 
            // Once clicked, FB might remove this button from the DOM, making .closest() fail later.
            const post = target.closest('[data-truthlayer-processed="true"]') || 
                         target.closest('[role="article"]') || 
                         target.closest('[data-pagelet*="FeedUnit"]');
            
            if (post) {
                console.log('TruthLayer: Post container captured. Waiting for DOM to expand...');
                
                setTimeout(() => {
                    console.log('TruthLayer: Triggering re-analysis now.');
                    // Clear the processed flag
                    post.removeAttribute('data-truthlayer-processed');
                    // Remove existing banner
                    const existingBanner = post.querySelector('.truthlayer-banner');
                    if (existingBanner) existingBanner.remove();
                    
                    // Trigger a scan
                    if (typeof runScan === 'function') runScan();
                }, 500); // Wait a bit longer for the text to fully swap
            } else {
                console.warn('TruthLayer: Could not find post container for "See more" button.');
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

function highlightPost(element) {
    if (DEBUG_MODE && element && !element.dataset.truthlayerHighlighted) {
        element.style.border = '2px dashed red';
        element.style.position = 'relative';
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
        element.appendChild(label);
        element.dataset.truthlayerHighlighted = 'true';
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
    const foundPosts = new Set();

    // 1. Target known specific FB post structures
    const selectors = [
        '[role="article"]',
        '[data-pagelet*="FeedUnit"]',
        '[data-pagelet*="GroupFeed"]',
        '[data-pagelet*="ProfileFeed"]',
        '[data-pagelet*="MainFeed"]'
    ];

    selectors.forEach(sel => {
        try {
            const elements = rootNode.querySelectorAll(sel);
            elements.forEach(el => {
                if (!el.dataset.truthlayerProcessed) foundPosts.add(el);
            });
        } catch (e) { }
    });

    // 2. Structural heuristics (find elements containing Facebook's internal post roles)
    const allDivs = rootNode.querySelectorAll('div');
    allDivs.forEach(div => {
        if (div.dataset.truthlayerProcessed) return;

        // A FB post usually has a message body and interaction buttons
        const hasMessage = div.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"], [data-ad-rendering-role="story_message"]');
        const hasLike = div.querySelector('[data-ad-rendering-role="like_button"], [aria-label="Like"]');
        const hasComment = div.querySelector('[data-ad-rendering-role="comment_button"], [aria-label="Leave a comment"]');

        if (hasMessage && (hasLike || hasComment)) {
            // Check text length to ensure it's substantial
            const text = hasMessage.innerText || hasMessage.textContent || '';
            if (text.length > 20) {
                if (isValidPost(div)) {
                    foundPosts.add(div);
                }
            }
        }
    });

    // 3. Prevent Nesting & Duplication
    const finalPosts = [];
    const postsArray = Array.from(foundPosts);

    for (let i = 0; i < postsArray.length; i++) {
        let isParentOfAnother = false;

        // Check if this post contains any other newly detected post
        for (let j = 0; j < postsArray.length; j++) {
            if (i === j) continue;
            if (postsArray[i].contains(postsArray[j])) {
                isParentOfAnother = true;
                break;
            }
        }

        // Also check if it contains a previously processed post
        if (!isParentOfAnother) {
            if (postsArray[i].querySelector('[data-truthlayer-processed="true"]')) {
                isParentOfAnother = true;
            }
        }

        // We only want the most specific (innermost) container to avoid the nested banners issue
        if (!isParentOfAnother) {
            // Also ensure it doesn't already have our banner from a previous run
            if (!postsArray[i].querySelector('.truthlayer-banner')) {
                finalPosts.push(postsArray[i]);
            }
        }
    }

    return finalPosts;
}

function injectBanner(postElement, data) {
    const { score, label, reasons } = data;

    let themeClass = 'truthlayer-low';
    let icon = '✅';
    if (score < 50) {
        themeClass = 'truthlayer-high';
        icon = '🚨';
    } else if (score < 80) {
        themeClass = 'truthlayer-medium';
        icon = '⚠️';
    }

    const banner = document.createElement('div');
    banner.className = `truthlayer-banner truthlayer-popup ${themeClass}`;

    // Remove any existing banner (e.g. if the post was re-analyzed after clicking "See more")
    const existing = postElement.querySelector('.truthlayer-banner');
    if (existing) {
        existing.remove();
    }

    // Create Reasons HTML
    const reasonsId = `reasons-${Date.now()}`;
    let reasonsHtml = '';
    if (reasons && reasons.length > 0) {
        reasonsHtml = `
            <div class="truthlayer-reasons" id="${reasonsId}">
                <ul>
                    ${reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        reasonsHtml = `
            <div class="truthlayer-reasons" id="${reasonsId}">
                <p style="margin: 0;">No significant risks detected.</p>
            </div>
        `;
    }

    banner.innerHTML = `
        <div class="truthlayer-header">
            <div class="truthlayer-title">
                ${icon} TruthLayer: ${label}
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="truthlayer-score">Score: ${score}/100</div>
                <button class="truthlayer-toggle">Why?</button>
            </div>
        </div>
        ${reasonsHtml}
    `;

    const toggleBtn = banner.querySelector('.truthlayer-toggle');
    const reasonsDiv = banner.querySelector('.truthlayer-reasons');

    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (reasonsDiv.classList.contains('open')) {
            reasonsDiv.classList.remove('open');
            toggleBtn.textContent = 'Why?';
        } else {
            reasonsDiv.classList.add('open');
            toggleBtn.textContent = 'Hide';
        }
    });

    // Inject into DOM (at the top of the post)
    postElement.insertBefore(banner, postElement.firstChild);

    const currentPosition = window.getComputedStyle(postElement).position;
    if (!currentPosition || currentPosition === 'static') {
        postElement.style.position = 'relative';
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
    if (postElement.dataset.truthlayerProcessed === "true") return;

    let text = extractTextFromPost(postElement);

    if (!text || text.length < 20) {
        debugLog('Found post but text too short or empty. Length:', text ? text.length : 0);
        return;
    }

    // Mark as processed immediately to avoid duplicate network calls
    postElement.dataset.truthlayerProcessed = "true";

    debugLog('Processing post. Extracted text length:', text.length);
    highlightPost(postElement);

    console.log('TruthLayer sending text for validation:', text);

    try {
        chrome.runtime.sendMessage({
            type: 'ANALYZE_CONTENT',
            content: text,
            url: window.location.href
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('TruthLayer: Runtime error', chrome.runtime.lastError);
                injectBanner(postElement, getDefaultAnalysis(text, chrome.runtime.lastError.message));
                return;
            }
            if (response && response.success) {
                injectBanner(postElement, response.data);
            } else {
                console.error('TruthLayer: Backend error', response?.error);
                injectBanner(postElement, getDefaultAnalysis(text, response?.error));
            }
        });
    } catch (error) {
        console.error('TruthLayer: Extension communication error', error);
        injectBanner(postElement, getDefaultAnalysis(text, error?.message));
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

const runScan = debounce(() => {
    debugLog('Running batched DOM scan...');
    const posts = detectPosts();
    debugLog(`Detected ${posts.length} new posts.`);
    posts.forEach(processPost);
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

console.log("TruthLayer extension loaded (Heuristics V3).");
runScan();

// Initial scan for posts already on the page when the script loads
function initialScan() {
    const posts = detectPosts();
    posts.forEach(processPost);
}

function periodicRescan() {
    setInterval(() => {
        const posts = detectPosts();
        posts.forEach(processPost);
    }, 1500);
}

// Initialize
console.log("TruthLayer extension loaded.");
initialScan();
observeDOM();
periodicRescan();
