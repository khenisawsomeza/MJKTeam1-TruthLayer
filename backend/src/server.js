const app = require('./app');
const { PORT } = require('./config');

app.listen(PORT, () => {
    console.log(`TruthLayer Backend running on http://localhost:${PORT}`);
});

