/**
 * TruthLayer - Background Service Worker
 * Handles communication between popup and backend API.
 */
const API_URL = 'http://localhost:3000/analyze';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_CONTENT') {
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: request.content,
                url: request.url
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            return response.json();
        })
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));

        // Return true to indicate async response
        return true;
    }
});
