const axios = require('axios');

const { AI_SERVICE_TIMEOUT_MS, AI_SERVICE_URL } = require('../config');

async function analyzeWithAiService(payload) {
    const response = await axios.post(AI_SERVICE_URL, payload, {
        timeout: AI_SERVICE_TIMEOUT_MS
    });
    return response.data;
}

module.exports = {
    analyzeWithAiService
};
