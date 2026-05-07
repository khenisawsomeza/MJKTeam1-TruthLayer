const PORT = process.env.PORT || 3000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000/analyze';
const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS || 30000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

module.exports = {
    PORT,
    AI_SERVICE_URL,
    AI_SERVICE_TIMEOUT_MS,
    CORS_ORIGIN
};
