import requests
import os
from dotenv import load_dotenv

load_dotenv()
HF_API_KEY = os.environ.get("HUGGINGFACE_API_KEY")

headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}
urls = [
    "https://api-inference.huggingface.co/pipeline/zero-shot-classification/facebook/bart-large-mnli",
    "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
    "https://api-inference.huggingface.co/models/typeform/distilbert-base-uncased-mnli"
]

payload = {
    "inputs": "The earth is flat.",
    "parameters": {"candidate_labels": ["contradiction", "entailment", "neutral"]}
}

for url in urls:
    try:
        r = requests.post(url, headers=headers, json=payload)
        print(f"{url} -> {r.status_code}")
        if r.status_code == 200:
            print(r.json())
        else:
            print(r.text)
    except Exception as e:
        print(e)
