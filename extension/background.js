/**
 * TruthLayer - Background Service Worker
 * Handles communication between popup and backend API.
 */
const API_URL = 'http://localhost:3000/analyze';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_CONTENT') {
        console.log(`TruthLayer: Received analysis request for ${request.url}`);
        
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
                return response.json().then(err => {
                    throw new Error(err.error || `Server error: ${response.status}`);
                }).catch(() => {
                    throw new Error(`Server responded with ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('TruthLayer: Analysis success', data);
            sendResponse({ success: true, data });
        })
        .catch(error => {
            console.error('TruthLayer: Analysis error', error);
            sendResponse({ success: false, error: error.message });
        });

        // Return true to indicate async response
        return true;
    }
});
