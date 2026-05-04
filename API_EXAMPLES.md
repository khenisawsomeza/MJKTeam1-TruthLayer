# TruthLayer API Examples & Test Cases

Complete collection of API test cases and expected responses for the TruthLayer multi-layer credibility scoring system.

---

## Table of Contents
1. [API Endpoints](#api-endpoints)
2. [Test Cases](#test-cases)
3. [cURL Examples](#curl-examples)
4. [Response Interpretation](#response-interpretation)
5. [Common Issues](#common-issues)

---

## API Endpoints

### 1. Analyze Content
**POST** `/analyze`

Performs multi-layer credibility analysis on provided text.

**Request:**
```json
{
  "text": "Article or post text to analyze",
  "url": "https://source-domain.com",
  "content": "Alternative field name (if using content instead of text)"
}
```

**Response:**
```json
{
  "score": 0-100,
  "confidence": 0-1,
  "label": "Low Risk|Medium Risk|High Risk|Uncertain",
  "narrative": "Human-readable explanation",
  "reasons": ["Finding 1", "Finding 2"],
  "breakdown": {
    "rule": 0-100,
    "ml": 0-100,
    "source": 0-100
  },
  "keyFindings": ["Top findings"],
  "metadata": {
    "timestamp": "ISO timestamp",
    "mlAvailable": boolean,
    "sourceUrl": "URL or null",
    "textLength": number
  }
}
```

### 2. Health Check
**GET** `/health`

Check if backend service is running and operational.

**Response:**
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

### 3. Cache Statistics
**GET** `/cache-stats`

Get current cache statistics.

**Response:**
```json
{
  "cacheSize": 5,
  "cacheTTL": "600s"
}
```

### 4. Clear Cache
**POST** `/cache-clear`

Clear all cached analyses.

**Response:**
```json
{
  "message": "Cache cleared",
  "size": 0
}
```

---

## Test Cases

### Test Case 1: Classic Misinformation (High Risk)

**Description:** Sensational headline with multiple red flags

**Input:**
```json
{
  "text": "SHOCKING BREAKING NEWS!!! Doctors HATE this one weird trick discovered in 2024!!! Researchers don't want you to know!!!",
  "url": "https://suspicious-health-blog.blogspot.com"
}
```

**Expected Output (Score: 15-35):**
```
Label: High Risk
Confidence: 0.8+
Key Issues:
  - Sensational keywords (shocking, hate)
  - Clickbait pattern
  - Excessive punctuation
  - Multiple caps words
  - Suspicious domain (blogspot)
```

**Why High Risk:**
- Multiple rule violations (-15, -12, -10 penalties)
- ML model trained to recognize this pattern
- Blogspot identified as generic/unverified

---

### Test Case 2: Credible News Report (Low Risk)

**Description:** Factual reporting from trusted source

**Input:**
```json
{
  "text": "The Federal Reserve announced today that it will maintain current interest rates. Economists noted this decision reflects confidence in recent economic improvements.",
  "url": "https://reuters.com/business"
}
```

**Expected Output (Score: 75-95):**
```
Label: Low Risk
Confidence: 0.7+
Key Features:
  - Neutral, factual language
  - No sensational keywords
  - Normal punctuation
  - Trusted source (Reuters)
  - Professional writing style
```

**Why Low Risk:**
- Rule score: 100 (no violations)
- ML score: 85+ (factual pattern)
- Source score: 90 (trusted domain)

---

### Test Case 3: Mixed Signals (Medium Risk)

**Description:** Legitimate information with presentation issues

**Input:**
```json
{
  "text": "New study reveals that coffee consumption can improve cognitive function!!! Researchers from top universities found evidence!!!",
  "url": "https://health-blog-unknown.com"
}
```

**Expected Output (Score: 55-70):**
```
Label: Medium Risk
Confidence: 0.4-0.6
Mixed Indicators:
  - Content could be real but presented sensationally
  - Excessive punctuation is a red flag
  - Source is unverified (not in trusted list)
  - ML model has lower confidence
```

**Why Medium Risk:**
- Rule score: 70 (excessive punctuation penalty)
- ML score: 65 (legitimate research pattern, but mixed signals)
- Source score: 55 (unverified domain)

---

### Test Case 4: URL Shortener (Medium-High Risk)

**Description:** Legitimate content but suspicious source pattern

**Input:**
```json
{
  "text": "Great article about climate science.",
  "url": "https://bit.ly/2abc123"
}
```

**Expected Output (Score: 35-55):**
```
Label: Medium Risk or High Risk
Issues:
  - URL shortener detected (bit.ly)
  - Cannot verify final destination
  - URL shorteners often hide spam/phishing
```

**Why Medium-High Risk:**
- Source score: 30 (URL shortener identified)
- Rule score: 100 (clean text)
- ML score: 80 (legitimate text)
- Weighted: (100 * 0.3) + (80 * 0.5) + (30 * 0.2) = 71
- But lower confidence due to URL shortener

---

### Test Case 5: Very Short Text (Low Confidence)

**Description:** Insufficient data for reliable analysis

**Input:**
```json
{
  "text": "This is fake!",
  "url": "https://example.com"
}
```

**Expected Output (Score: 50-60, Low Confidence):**
```
Label: Medium Risk or Uncertain
Issues:
  - Text too short for reliable analysis
  - Confidence will be lower (<0.4)
  - Recommendation: Verify with additional sources
```

**Why Lower Confidence:**
- Rule score penalty for short text (-5)
- ML model needs more context
- Confidence calculation reflects uncertainty

---

### Test Case 6: Empty Input

**Description:** No text provided

**Input:**
```json
{
  "text": "",
  "url": "https://example.com"
}
```

**Expected Output (Error):**
```json
{
  "error": "Text or content is required",
  "score": null,
  "confidence": null
}
```

**HTTP Status:** 400 Bad Request

---

### Test Case 7: ML Service Offline Fallback

**Description:** Backend functions even if Python service is down

**Input:**
```json
{
  "text": "Some content here",
  "url": "https://example.com"
}
```

**Expected Output (When AI Service Down):**
```json
{
  "score": 65,
  "confidence": 0.0,
  "label": "Medium Risk",
  "narrative": "...",
  "metadata": {
    "mlAvailable": false
  }
}
```

**Note:** Score will be calculated from rule + source only (no ML layer)

---

## cURL Examples

### Example 1: High-Risk Misinformation

```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "SHOCKING: Doctors HATE this one weird trick!!!",
    "url": "https://suspicious-blog.blogspot.com"
  }' | python3 -m json.tool
```

### Example 2: Credible News

```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Local city council approves new park renovation.",
    "url": "https://bbc.com/news"
  }' | python3 -m json.tool
```

### Example 3: Wikipedia Article

```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The Statue of Liberty was designed by Frédéric Auguste Bartholdi and dedicated on October 28, 1886.",
    "url": "https://wikipedia.org/wiki/Statue_of_Liberty"
  }' | python3 -m json.tool
```

### Example 4: Social Media Post

```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Just heard this AMAZING secret about fitness that trainers dont want you to know!!!",
    "url": "https://twitter.com/someone/status/123456"
  }' | python3 -m json.tool
```

### Example 5: No URL Provided

```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is some content without a source URL"
  }' | python3 -m json.tool
```

### Example 6: Batch Testing

```bash
# Test multiple items
for text in \
  "SHOCKING NEWS!!!" \
  "Local council approves budget." \
  "Study shows benefits of exercise." \
  ; do
  echo "Testing: $text"
  curl -s -X POST http://localhost:3000/analyze \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$text\"}" | grep -o '"score":[0-9.]*'
done
```

---

## Response Interpretation

### Score Scale

| Score Range | Label | Interpretation | Action |
|------------|-------|-----------------|--------|
| 80-100 | Low Risk | Content appears credible | Trust it |
| 50-79 | Medium Risk | Mixed signals or minor concerns | Verify with other sources |
| 20-49 | High Risk | Multiple red flags detected | Treat with skepticism |
| 0-19 | High Risk | Very suspicious patterns | Do not trust |

### Confidence Scale

| Confidence | Meaning | Recommendation |
|-----------|---------|-----------------|
| 0.9-1.0 | Very high | Assessment is reliable |
| 0.7-0.8 | High | Assessment is fairly reliable |
| 0.5-0.6 | Medium | Cross-check with other sources |
| 0.3-0.4 | Low | Do not rely solely on this score |
| 0.0-0.2 | Very low | Insufficient data - seek other sources |

### Label Categories

**Low Risk** (Green ✓)
- Credible content
- Factual presentation
- Trusted source or clean language
- Safe to share

**Medium Risk** (Yellow ⚠)
- Mixed signals detected
- Slight concerns but not conclusive
- Should verify important claims
- OK to discuss with context

**High Risk** (Red ✗)
- Multiple red flags
- Suspicious patterns detected
- Likely misinformation
- Should not spread

**Uncertain** (Gray ?)
- Insufficient data
- Conflicting indicators
- Need more information
- Recommend fact-checking

---

## Breakdown Interpretation

The breakdown shows individual layer scores:

```json
"breakdown": {
  "rule": 80,        // Rule-based analysis score
  "ml": 72,          // ML model prediction score
  "source": 90       // Source credibility score
}
```

**Large Differences Between Layers:**
- Rule=80, ML=40 → Rules think it's OK, but ML detects issues
- Indicates conflicting signals
- Lower overall confidence

**Similar Scores Across Layers:**
- All near 80 or all near 40
- Methods agree → Higher confidence
- More reliable assessment

---

## Common Issues & Troubleshooting

### Issue 1: "Cannot connect to localhost:3000"

**Solution:**
```bash
# Check if backend is running
curl http://localhost:3000/health

# If not running, start it
cd backend
npm start
```

### Issue 2: "ML Service unavailable"

**Solution:**
```bash
# Check if AI service is running
curl http://127.0.0.1:8000/health

# If not running, start it
cd ai-service
python3 -m uvicorn app:app --port 8000

# Verify models exist
ls -la ai-service/*.pkl

# If missing, retrain
cd ai-service
python3 train.py
```

### Issue 3: All scores at default (50/50)

**Possible Causes:**
- ML models not loaded properly
- Python service not responding
- Models not trained

**Solution:**
```bash
# Check model files
ls -la ai-service/*.pkl

# Retrain if needed
cd ai-service
python3 train.py

# Restart both services
```

### Issue 4: Response times > 500ms

**Causes:**
- Network latency
- ML model inference taking time
- High system load

**Optimization:**
- Responses are cached for 10 min
- Second request for same content: <5ms
- Check cache stats: `curl http://localhost:3000/cache-stats`

### Issue 5: Inconsistent scores for same content

**Possible Causes:**
- Different URLs provided
- ML model stochasticity (rare)
- Cache cleared between requests

**Solution:**
- Scores should be consistent for identical text + URL
- Check cache hit rate
- Use `/cache-stats` to verify caching

---

## Performance Testing

### Load Test Example

```bash
# Test 100 requests
for i in {1..100}; do
  curl -s -X POST http://localhost:3000/analyze \
    -H "Content-Type: application/json" \
    -d '{"text": "Test content '$i'", "url": "https://example.com"}' \
    > /dev/null &
done
wait

# Results
echo "Test complete"
curl http://localhost:3000/cache-stats
```

### Response Time Benchmark

```bash
# Time a single request
time curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Sample content", "url": "https://example.com"}' \
  > /dev/null
```

**Expected Times:**
- First request: 100-200ms
- Cached request: <10ms
- Average (mixed): 50-150ms

---

## Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function analyzeContent(text, url) {
  try {
    const response = await axios.post('http://localhost:3000/analyze', {
      text,
      url
    });
    console.log('Score:', response.data.score);
    console.log('Label:', response.data.label);
    return response.data;
  } catch (error) {
    console.error('Analysis error:', error.message);
  }
}

// Usage
analyzeContent('Some content here', 'https://example.com');
```

### Python

```python
import requests

def analyze_content(text, url):
    try:
        response = requests.post('http://localhost:3000/analyze', 
            json={'text': text, 'url': url}
        )
        data = response.json()
        print(f"Score: {data['score']}")
        print(f"Label: {data['label']}")
        return data
    except Exception as e:
        print(f"Error: {e}")

# Usage
analyze_content("Some content here", "https://example.com")
```

### cURL with jq

```bash
# Get score and label
curl -s -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"content", "url":"https://example.com"}' | \
  jq '{score: .score, label: .label, confidence: .confidence}'
```

---

## Postman Collection

Import this into Postman for easy API testing:

```json
{
  "info": {
    "name": "TruthLayer API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Analyze - High Risk",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/analyze",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "raw": "{\"text\": \"SHOCKING: Doctors HATE this!!!\", \"url\": \"https://suspicious-blog.blogspot.com\"}"
        }
      }
    },
    {
      "name": "Analyze - Low Risk",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/analyze",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "raw": "{\"text\": \"Local council approves park renovation.\", \"url\": \"https://bbc.com\"}"
        }
      }
    },
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/health"
      }
    },
    {
      "name": "Cache Stats",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/cache-stats"
      }
    }
  ]
}
```

---

## Summary

The TruthLayer API provides comprehensive credibility analysis through multiple layers. Use these test cases and examples to:

✅ Verify system functionality  
✅ Understand scoring logic  
✅ Test different content types  
✅ Integrate into your application  
✅ Debug issues  

For production use, monitor cache hit rates and adjust weights as needed based on your specific use case.
