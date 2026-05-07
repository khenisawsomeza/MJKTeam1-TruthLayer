const PORT = process.env.PORT || 3000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000/analyze';

module.exports = {
    PORT,
    AI_SERVICE_URL
};

