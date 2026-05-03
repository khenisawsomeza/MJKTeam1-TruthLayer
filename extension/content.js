// API Endpoint (Node.js Backend)
const API_URL = 'http://localhost:3000/analyze';

// Function to extract text from a Facebook post element
function extractTextFromPost(postElement) {
    // Facebook has complex nested divs, simple textContent gets almost everything
    // But we might want to filter out hidden elements or buttons if needed
    // For MVP, textContent is usually sufficient
    return postElement.textContent.trim();
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
    
    // Mark as processing immediately to prevent duplicate triggers
    postElement.dataset.truthlayerProcessed = "true";

    const text = extractTextFromPost(postElement);
    if (!text || text.length < 20) return; // Ignore very short posts

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (response.ok) {
            const data = await response.json();
            injectBanner(postElement, data);
        } else {
            console.error('TruthLayer: Failed to analyze post', response.status);
        }
    } catch (error) {
        console.error('TruthLayer: Error connecting to backend', error);
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
