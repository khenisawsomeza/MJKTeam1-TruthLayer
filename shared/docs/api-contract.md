# TruthLayer API Contract

The Chrome extension calls the Node backend at `POST /analyze`.

The Node backend calls the Python AI service at `POST /analyze` with:

```json
{
  "text": "content to analyze",
  "source_score": 50
}
```

Response field names are intentionally preserved for extension compatibility.

