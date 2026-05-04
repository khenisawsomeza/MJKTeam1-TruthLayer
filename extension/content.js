const DEBUG_MODE = true;

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[TruthLayer Debug]', ...args);
    }
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
            if (i === 0 || lines[i] !== lines[i-1]) {
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
        } catch (e) {}
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
    banner.className = `truthlayer-banner ${themeClass}`;
    
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

    postElement.insertBefore(banner, postElement.firstChild);
}

async function processPost(postElement) {
    if (postElement.dataset.truthlayerProcessed === "true") return;

    const text = extractPostText(postElement);
    
    if (!text || text.length < 20) {
        debugLog('Found post but text too short or empty. Length:', text ? text.length : 0);
        return; 
    }

    postElement.dataset.truthlayerProcessed = "true";

    debugLog('Processing post. Extracted text length:', text.length);
    highlightPost(postElement);

    // Safety check: ensure extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
        debugLog('Extension context invalidated. Stopping process.');
        return;
    }

    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ 
                type: 'ANALYZE_CONTENT', 
                content: text.substring(0, 5000),
                url: window.location.href 
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const msg = chrome.runtime.lastError.message;
                    if (!msg.includes('context invalidated') && !msg.includes('message port closed')) {
                        console.error('TruthLayer: Runtime error', msg);
                    }
                    resolve();
                    return;
                }
                
                if (response && response.success) {
                    injectBanner(postElement, response.data);
                }
                resolve();
            });
        } catch (error) {
            if (!error.message.includes('context invalidated')) {
                console.error('TruthLayer: Extension communication error', error);
            }
            resolve();
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

const runScan = debounce(async () => {
    debugLog('Running batched DOM scan...');
    const posts = detectPosts();
    debugLog(`Detected ${posts.length} new posts.`);
    
    // Process sequentially to avoid overwhelming the background port
    for (const post of posts) {
        await processPost(post);
    }
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
observeDOM();
