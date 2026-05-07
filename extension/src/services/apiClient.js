const API_URL = self.TRUTHLAYER_CONFIG?.API_URL || 'http://localhost:3000/analyze';

function analyzeContent(payload) {
    return fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
    });
}
