# TruthLayer - Multi-Layer Credibility Scoring System

## 🎯 Overview

TruthLayer is a hybrid credibility scoring system that combines multiple analysis layers:

1. **Rule-Based Scoring** (30% weight) - Detects sensational language, clickbait patterns, and suspicious punctuation
2. **ML-Based Scoring** (50% weight) - Uses trained LogisticRegression model with TF-IDF vectorization
3. **Source Credibility** (20% weight) - Evaluates domain reputation against trusted/suspicious lists
4. **Confidence Calculation** - Measures agreement between scoring methods
5. **Explainability Engine** - Generates human-readable explanations

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 14+ (for backend)
- **Python** 3.8+ (for AI service)
- **pip** (Python package manager)

### Installation

#### 1. Backend Setup (Node.js)

```bash
cd backend
npm install
```

#### 2. Python AI Service Setup

```bash
cd ai-service

# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Train the ML model
python train.py
```

**Output:**
```
Training TruthLayer ML Model...
Dataset size: 20 examples
Initializing TfidfVectorizer with ngram_range=(1,2) and max_features=5000...
✓ Model saved to model.pkl
✓ Vectorizer saved to vectorizer.pkl
Training complete! Models are ready for predictions.
```

---

## ▶️ Running the System

### 1. Start Python AI Service

```bash
cd ai-service
python -m uvicorn app:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 2. Start Node.js Backend (in another terminal)

```bash
cd backend
npm start
```

Expected output:
```
🚀 TruthLayer Backend running on http://localhost:3000
📊 Multi-layer scoring system active
```

### 3. Make Test Requests

```bash
# Test with high-risk content
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "SHOCKING: Doctors HATE this one weird trick discovered in 2024!!!",
    "url": "https://example.com"
  }'

# Test with low-risk content
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Local city council approves new park renovation project.",
    "url": "https://bbc.com"
  }'
```

---

## 📊 API Response Format

### Request

```json
{
  "text": "Article or post text to analyze",
  "url": "https://source-domain.com",
  "content": "alternative to 'text' field"
}
```

### Response (Success)

```json
{
  "score": 72.4,
  "confidence": 0.85,
  "label": "Low Risk",
  "narrative": "This content appears credible (72.4/100). Language patterns align with factual reporting. Source appears reliable. Assessment is based on consistent indicators.",
  "reasons": [
    "Excessive question marks (3)",
    "ML model predicts 28% likelihood of misinformation",
    "Source domain is unverified: example.com"
  ],
  "breakdown": {
    "rule": 80.0,
    "ml": 72.0,
    "source": 55.0
  },
  "keyFindings": [
    "Excessive question marks (3)",
    "ML analysis complete"
  ],
  "metadata": {
    "timestamp": "2024-05-04T10:30:00.000Z",
    "mlAvailable": true,
    "sourceUrl": "https://example.com",
    "textLength": 150
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Final credibility score (0-100). Higher = more credible |
| `confidence` | number | Model confidence (0-1). How certain the system is |
| `label` | string | Risk category: "Low Risk", "Medium Risk", "High Risk", "Uncertain" |
| `narrative` | string | Human-readable explanation of the assessment |
| `reasons` | array | List of specific findings and concerns |
| `breakdown` | object | Score breakdown by analysis layer |
| `keyFindings` | array | Top 3 concerns (empty if no issues found) |
| `metadata` | object | Diagnostic information |

---

## 🧠 Scoring Layers Explained

### Layer 1: Rule-Based Scoring (30%)

Analyzes text patterns:

- **Sensational Keywords**: shocking, breaking, miracle, secret, proof, warning, etc.
- **Clickbait Patterns**: "X weird tricks", "doctors hate", "$XXX per week", etc.
- **Punctuation**: Excessive ! ? marks, ellipsis patterns
- **Capitalization**: Multiple ALL CAPS words, erratic casing
- **Length**: Very short texts (<50 chars) are flagged

**Deductions:**
- Sensational keyword: -15
- Clickbait pattern: -12
- Excessive punctuation: -10
- Multiple ALL CAPS: -10
- Short text: -5

### Layer 2: ML Model Scoring (50%)

Uses LogisticRegression trained on:
- **Features**: TF-IDF with bigrams (1,2-grams), max 5000 features
- **Training Data**: Balanced mix of real and fake examples
- **Output**: Probability of misinformation (0-1)
- **Converted to Score**: `(1 - fake_probability) * 100`

**Confidence Calculation:**
```
confidence = abs(fake_probability - 0.5) * 2
```
- Range: 0 (uncertain) to 1 (very certain)

### Layer 3: Source Credibility (20%)

Evaluates URL domain:

- **Trusted Domains** (score: 90): BBC, Reuters, AP News, Guardian, NYT, etc.
- **Suspicious Domains** (score: 30): URL shorteners, generic blog platforms
- **Unverified Domains** (score: 55): Unknown sources
- **Invalid URLs** (score: 40): Malformed URLs

### Layer 4: Aggregation

**Final Score Formula:**
```
final_score = (rule_score × 0.3) + (ml_score × 0.5) + (source_score × 0.2)
```

**Confidence Calculation:**
```
agreement = 1 - avg_difference_between_methods
confidence = (ml_confidence × 0.6) + (method_agreement × 0.4)
```

### Layer 5: Explainability

Generates narratives based on:
- Score and risk label
- Detected issues
- Method agreement
- Source information

---

## 📁 Project Structure

```
backend/
├── server.js                 # Main Express server with multi-layer routing
├── package.json
└── scoring/
    ├── index.js             # Module exports
    ├── rules.js             # Rule-based analysis
    ├── sourceChecker.js     # Domain credibility
    ├── aggregator.js        # Score combination
    └── explainer.js         # Explanation generation

ai-service/
├── app.py                   # FastAPI server with ML prediction
├── train.py                 # Training script
├── requirements.txt
├── model.pkl                # Trained LogisticRegression model (generated)
└── vectorizer.pkl           # TF-IDF vectorizer (generated)

extension/
├── manifest.json
├── background.js
├── content.js
├── popup.js
└── ...
```

---

## 🔧 Configuration

### Rule-Based Scoring Tweaks

Edit `backend/scoring/rules.js`:

```javascript
const SENSATIONAL_KEYWORDS = [
    'shocking', 'unbelievable', // Add/remove keywords
    // ...
];

const CLICKBAIT_PATTERNS = [
    /\b\d+\s*(million|billion)\s*people/i,
    // Add/remove regex patterns
];
```

### ML Model Retraining

Edit `ai-service/train.py`:

```python
# Modify dataset
data = [
    ("Your text here", 1),  # 1 = fake, 0 = real
    ("Real news", 0),
    # Add more examples
]

# Adjust vectorizer
vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),      # Change range if needed
    max_features=5000,        # Adjust feature count
)

# Adjust model
model = LogisticRegression(max_iter=1000)
```

Then retrain:
```bash
python train.py
```

### Scoring Weights

Edit `backend/scoring/aggregator.js`:

```javascript
const finalScore = 
    (rule * 0.3) +    // Change weights here
    (ml * 0.5) +
    (source * 0.2);
```

### Trusted/Suspicious Domains

Edit `backend/scoring/sourceChecker.js`:

```javascript
const TRUSTED_DOMAINS = [
    'bbc.com',
    'reuters.com',
    // Add more trusted domains
];

const SUSPICIOUS_DOMAINS = [
    'bit.ly',
    // Add more suspicious domains
];
```

---

## 🧪 Example API Calls

### Example 1: High-Risk Misinformation

**Request:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "SHOCKING: You wont believe what they found!!! Secret miracle cure doctors HATE!!! Click now!!!",
    "url": "https://suspicious-blog.blogspot.com"
  }'
```

**Response:**
```json
{
  "score": 18.5,
  "confidence": 0.92,
  "label": "High Risk",
  "narrative": "This content exhibits credibility concerns (18.5/100). Multiple red flags detected including sensational language, unverified sources, or suspicious patterns. Assessment is based on consistent indicators.",
  "reasons": [
    "Sensational keyword detected: \"shocking\"",
    "Excessive exclamation marks (3)",
    "Clickbait pattern detected",
    "ML model predicts 92% likelihood of misinformation",
    "Source shows suspicious characteristics: suspicious-blog.blogspot.com"
  ],
  "breakdown": {
    "rule": 25.0,
    "ml": 8.0,
    "source": 30.0
  },
  "keyFindings": [
    "Sensational keyword detected: \"shocking\"",
    "Excessive exclamation marks (3)",
    "ML model predicts 92% likelihood of misinformation"
  ],
  "metadata": {
    "timestamp": "2024-05-04T10:30:00.000Z",
    "mlAvailable": true,
    "sourceUrl": "https://suspicious-blog.blogspot.com",
    "textLength": 95
  }
}
```

### Example 2: Credible News Report

**Request:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Local city council approves new budget for park renovations on Main Street. The project aims to improve recreational facilities for residents.",
    "url": "https://bbc.com/local-news"
  }'
```

**Response:**
```json
{
  "score": 85.2,
  "confidence": 0.88,
  "label": "Low Risk",
  "narrative": "This content appears credible (85.2/100). Language patterns align with factual reporting. Source appears reliable. Assessment is based on consistent indicators.",
  "reasons": [
    "ML model predicts 15% likelihood of misinformation",
    "Source is from trusted publication: bbc.com"
  ],
  "breakdown": {
    "rule": 100.0,
    "ml": 85.0,
    "source": 90.0
  },
  "keyFindings": [],
  "metadata": {
    "timestamp": "2024-05-04T10:31:00.000Z",
    "mlAvailable": true,
    "sourceUrl": "https://bbc.com/local-news",
    "textLength": 156
  }
}
```

### Example 3: Mixed Signals

**Request:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "New study shows exercise improves health!!!",
    "url": "https://unknown-health-site.com"
  }'
```

**Response:**
```json
{
  "score": 54.3,
  "confidence": 0.62,
  "label": "Medium Risk",
  "narrative": "This content shows mixed signals (54.3/100). Some language patterns are concerning, but the source or AI analysis offers some reassurance.",
  "reasons": [
    "Excessive exclamation marks (3)",
    "ML model predicts 45% likelihood of misinformation",
    "Source domain is unverified: unknown-health-site.com"
  ],
  "breakdown": {
    "rule": 70.0,
    "ml": 55.0,
    "source": 55.0
  },
  "keyFindings": [
    "Excessive exclamation marks (3)",
    "Source domain is unverified: unknown-health-site.com"
  ],
  "metadata": {
    "timestamp": "2024-05-04T10:32:00.000Z",
    "mlAvailable": true,
    "sourceUrl": "https://unknown-health-site.com",
    "textLength": 48
  }
}
```

---

## 🔍 Debugging & Logging

### Check ML Service Health

```bash
curl http://127.0.0.1:8000/health
```

Output:
```json
{
  "status": "ok",
  "ml_available": true,
  "service": "TruthLayer AI Service"
}
```

### Check Backend Health

```bash
curl http://localhost:3000/health
```

Output:
```json
{
  "status": "ok",
  "service": "TruthLayer Backend",
  "layers": [
    "Rule-based scoring",
    "ML model prediction",
    "Source credibility",
    "Score aggregation",
    "Explainability engine"
  ]
}
```

### View Cache Statistics

```bash
curl http://localhost:3000/cache-stats
```

### Clear Cache

```bash
curl -X POST http://localhost:3000/cache-clear
```

---

## 📈 Performance Considerations

### Response Times

- **Rule-based analysis**: <5ms
- **ML prediction**: 50-100ms (first request) / <5ms (cached)
- **Source lookup**: <1ms
- **Total**: Target <200ms (usually <150ms)

### Caching

- Responses cached for 10 minutes by default
- Cleared on demand via `/cache-clear`
- Adjust TTL in `server.js`: `CACHE_TTL`

### Optimization Tips

1. **Reuse connections** in client code
2. **Batch requests** if possible
3. **Monitor cache hit rate** via `/cache-stats`
4. **Reduce model features** if needed (change `max_features` in train.py)

---

## 🎯 Use Cases

### Content Moderation
Use the system to flag suspicious user-generated content with explanations.

### News Feed Credibility
Add credibility badges to news items based on score.

### Fact-Checking Assistance
Prioritize which claims need fact-checkers based on risk scores.

### Browser Extension
Real-time credibility scoring for articles and social media posts.

---

## 🚀 Future Enhancements

- [ ] External fact-checking API integration (e.g., Google Fact Check API)
- [ ] Real-time training on new examples
- [ ] Multi-language support
- [ ] Image and video credibility scoring
- [ ] User feedback loop for model improvement
- [ ] Explainability visualization dashboard
- [ ] A/B testing framework

---

## 📝 License

TruthLayer - Building trustworthy AI systems

---

## 🤝 Support

For issues or questions:

1. Check `/health` endpoints
2. Review server logs
3. Verify both services are running
4. Ensure Python requirements are installed
5. Retrain ML model if needed

