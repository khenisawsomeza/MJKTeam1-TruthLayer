chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_CONTENT') {
        console.log(`TruthLayer: Received analysis request for ${request.url}`);

        const payload = {
            text: request.content,
            url: request.url,
            source: request.source,
            platform: request.platform,
            author: request.author,
            authorUrl: request.author?.url || null
        };

        // Log the outgoing payload for debugging author extraction
        console.log('TruthLayer background: sending payload to API', payload);

        analyzeContent(payload)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => {
                console.error('TruthLayer background: analyze fetch error', error);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate we will send a response asynchronously
        return true;
    }
});

