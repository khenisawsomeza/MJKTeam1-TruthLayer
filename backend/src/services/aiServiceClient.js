const axios = require('axios');

const { AI_SERVICE_URL } = require('../config');

async function analyzeWithAiService(payload) {
    const response = await axios.post(AI_SERVICE_URL, payload);
    return response.data;
}

module.exports = {
    analyzeWithAiService
};

