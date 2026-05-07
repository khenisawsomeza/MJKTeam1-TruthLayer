const express = require('express');
const cors = require('cors');

const analyzeRoutes = require('./routes/analyze.routes');
const versionRoutes = require('./routes/version.routes');
const { CORS_ORIGIN } = require('./config');

const app = express();

// Middlewares
const corsOrigin = CORS_ORIGIN === '*'
    ? '*'
    : CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use(analyzeRoutes);
app.use(versionRoutes);

module.exports = app;
