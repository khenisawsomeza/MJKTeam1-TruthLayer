// No longer need API_URL here, fetch is handled by background.js to bypass CSP
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
    
    return null;
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
    banner.className = `truthlayer-banner ${themeClass}`;
    
    // Create Reasons HTML
    let reasonsHtml = '';
    if (reasons && reasons.length > 0) {
        reasonsHtml = `
            <div class="truthlayer-reasons" id="reasons-${score}">
                <ul>
                    ${reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        reasonsHtml = `
            <div class="truthlayer-reasons" id="reasons-${score}">
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
    postElement.insertBefore(banner, postElement.firstChild);
}

// Function to process a single post
async function processPost(postElement) {
    if (postElement.dataset.truthlayerProcessed) return;

    // Filter out chat boxes: only process posts that are in the main content area or feed
    const isMainArea = postElement.closest('div[role="main"]') || postElement.closest('div[role="feed"]');
    if (!isMainArea) {
        // Mark it as processed so we don't constantly check chat messages
        postElement.dataset.truthlayerProcessed = "true";
        return;
    }

    const text = extractTextFromPost(postElement);
    // Ignore very short posts (like empty placeholders during lazy load)
    // Do NOT mark as processed yet so we can try again when text is populated
    if (!text || text.length < 20) return; 

    // Mark as processing only when we actually have text and are about to fetch
    postElement.dataset.truthlayerProcessed = "true";

    try {
        chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', text }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('TruthLayer: Runtime error', chrome.runtime.lastError);
                return;
            }
            if (response && response.success) {
                injectBanner(postElement, response.data);
            } else {
                console.error('TruthLayer: Backend error', response?.error);
            }
        });
    } catch (error) {
        console.error('TruthLayer: Extension communication error', error);
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
                        if (node.getAttribute('role') === 'article') {
                            processPost(node);
                        }
                        // Check if the added node is INSIDE a post (for lazy-loaded text)
                        else if (node.closest && node.closest('div[role="article"]')) {
                            processPost(node.closest('div[role="article"]'));
                        }
                        // Check if the added node contains posts
                        else {
                            const posts = node.querySelectorAll('div[role="article"]');
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
    const posts = document.querySelectorAll('div[role="article"]');
    posts.forEach(processPost);
}

// Initialize
console.log("TruthLayer extension loaded.");
initialScan();
observeDOM();
