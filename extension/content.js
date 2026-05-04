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
        try { modal.remove(); } catch (e) {}
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

// Function to inject the UI banner into the post
function injectBanner(postElement, data) {
    const { score, label, reasons } = data;

    // Determine class based on risk
    let themeClass = 'truthlayer-low';
    let icon = '✅';
    
    if (score < 50) {
        themeClass = 'truthlayer-high';
        icon = '🚨';
    } else if (score < 80) {
        themeClass = 'truthlayer-medium';
        icon = '⚠️';
    }

    // Create banner container
    const banner = document.createElement('div');
    banner.className = `truthlayer-banner truthlayer-popup ${themeClass}`;
    
    // Avoid injecting the banner multiple times for the same post
    if (postElement.querySelector('.truthlayer-banner')) return;
    
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

    // Add toggle functionality
    const toggleBtn = banner.querySelector('.truthlayer-toggle');
    const reasonsDiv = banner.querySelector('.truthlayer-reasons');
    
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = reasonsDiv.classList.contains('open');
        if (isOpen) {
            reasonsDiv.classList.remove('open');
            toggleBtn.textContent = 'Why?';
        } else {
            reasonsDiv.classList.add('open');
            toggleBtn.textContent = 'Hide';
        }
    });

    // Inject into DOM (at the top of the post)
    const currentPosition = window.getComputedStyle(postElement).position;
    if (!currentPosition || currentPosition === 'static') {
        postElement.style.position = 'relative';
    }

    postElement.appendChild(banner);
}

// Function to process a single post
async function processPost(postElement) {
    if (postElement.dataset.truthlayerProcessed) return;

    let text = extractTextFromPost(postElement);

    // Ensure we attempt to analyze every post (even short or image-only posts).
    if (!text) text = '';

    // Mark as processed immediately to avoid duplicate network calls
    postElement.dataset.truthlayerProcessed = "true";

    try {
        chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', text }, (response) => {
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

// Set up MutationObserver to watch for new posts as the user scrolls
function observeDOM() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the added node is a post
                        if (POST_SELECTORS.some(sel => node.matches && node.matches(sel))) {
                            processPost(node);
                        }
                        // Check if the added node is INSIDE a post (for lazy-loaded text)
                        else if (node.closest && (node.closest('div[role="article"]') || node.closest('article') || node.closest('div[data-pagelet*="FeedUnit"]'))) {
                            processPost(node.closest('div[role="article"]') || node.closest('article') || node.closest('div[data-pagelet*="FeedUnit"]'));
                        }
                        // Check if the added node contains posts
                        else {
                            const posts = getPostElements(node);
                            posts.forEach(processPost);
                        }
                    }
                });
            }
        }
    });

    // Start observing the document body for added nodes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initial scan for posts already on the page when the script loads
function initialScan() {
    const posts = getPostElements(document);
    posts.forEach(processPost);
}

function periodicRescan() {
    setInterval(() => {
        const posts = getPostElements(document);
        posts.forEach(processPost);
    }, 1500);
}

// Initialize
console.log("TruthLayer extension loaded.");
initialScan();
observeDOM();
periodicRescan();
