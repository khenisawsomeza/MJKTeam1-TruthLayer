const express = require('express');
const cors = require('cors');

const analyzeRoutes = require('./routes/analyze.routes');
const versionRoutes = require('./routes/version.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

app.use(analyzeRoutes);
app.use(versionRoutes);

module.exports = app;

