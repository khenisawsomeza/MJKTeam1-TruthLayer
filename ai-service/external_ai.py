import os
from typing import Dict, Any, List
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import json

load_dotenv()

# Load API Keys from env
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

def get_duckduckgo_search_results(query: str, max_results: int = 3) -> List[Dict[str, str]]:
    """
    Retrieves web search results using a simple HTML scrape of DuckDuckGo to avoid HTTP/2 protocol errors.
    """
    results = []
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}"
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for result in soup.find_all('div', class_='result', limit=max_results):
            title_elem = result.find('a', class_='result__url')
            snippet_elem = result.find('a', class_='result__snippet')
            
            if title_elem and snippet_elem:
                results.append({
                    "title": title_elem.text.strip(),
                    "snippet": snippet_elem.text.strip(),
                    "url": title_elem.get('href', '')
                })
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")
    return results

def extract_keywords(text: str) -> str:
    """
    Extracts a simplified query from the input text.
    For now, we just use the first 100 characters to avoid overly long search queries.
    """
    # Simply return the first 100 characters as a search query
    return text[:100]

def build_rag_prompt(claim: str, search_results: List[Dict[str, str]]) -> str:
    """
    Constructs the prompt for the AI model using the claim and retrieved evidence.
    """
    evidence_text = ""
    for i, res in enumerate(search_results):
        evidence_text += f"{i+1}. {res['snippet']}\n"
        
    prompt = f"""You are a fact-checking assistant. Evaluate the following claim based on the provided evidence.

Claim: {claim}

Evidence:
{evidence_text}

Task: Determine if the claim is likely true, false, or uncertain based on the evidence.
Respond ONLY with a valid JSON object in the exact following format, with no markdown formatting or backticks:
{{
  "label": "true" | "false" | "uncertain",
  "reasoning": "A short 1-sentence explanation of why."
}}
"""
    return prompt

def query_groq(prompt: str) -> Dict[str, Any]:
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0
    )
    result_text = response.choices[0].message.content.strip()
    if result_text.startswith("```json"):
        result_text = result_text.replace("```json", "").replace("```", "").strip()
    return json.loads(result_text)

def query_openai(prompt: str) -> Dict[str, Any]:
    import openai
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0
    )
    result_text = response.choices[0].message.content.strip()
    # Clean possible markdown
    if result_text.startswith("```json"):
        result_text = result_text.replace("```json", "").replace("```", "").strip()
    return json.loads(result_text)

def query_gemini(prompt: str) -> Dict[str, Any]:
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content(prompt, generation_config={"temperature": 0.0})
    result_text = response.text.strip()
    if result_text.startswith("```json"):
        result_text = result_text.replace("```json", "").replace("```", "").strip()
    return json.loads(result_text)

from functools import lru_cache

@lru_cache(maxsize=100)
def external_ai_score(text: str) -> Dict[str, Any]:
    """
    Main external AI verification function combining RAG and AI Inference.
    Prioritizes Groq, then OpenAI, then Gemini.
    """
    # Step 1: Web Retrieval (RAG Component)
    query = extract_keywords(text)
    search_results = get_duckduckgo_search_results(query, max_results=3)
    
    if not search_results:
        print("Web search failed or returned no results. Proceeding without RAG.")
        prompt = build_rag_prompt(text, [])
        evidence_used = []
    else:
        # Step 2: Build RAG Prompt
        prompt = build_rag_prompt(text, search_results)
        evidence_used = [res['url'] for res in search_results]

    # Step 3: AI Inference Logic
    ai_response = None
    
    try:
        if GROQ_API_KEY and GROQ_API_KEY.strip() != "":
            print("Using Groq for validation.")
            ai_response = query_groq(prompt)
        elif OPENAI_API_KEY and OPENAI_API_KEY.strip() != "":
            print("Using OpenAI for validation.")
            ai_response = query_openai(prompt)
        elif GEMINI_API_KEY and GEMINI_API_KEY.strip() != "":
            print("Using Google Gemini for validation.")
            ai_response = query_gemini(prompt)
        else:
            print("No valid API keys found. Defaulting to neutral.")
    except Exception as e:
        print(f"External AI Error: {e}")

    # Step 4: Parse Results
    if not ai_response or "label" not in ai_response:
        # Robustness: API failure -> neutral score
        return {
            "external_ai_score": 0.5,
            "label": "uncertain",
            "evidence_used": evidence_used,
            "reasoning": "External AI analysis unavailable or failed."
        }
        
    label = ai_response.get("label", "uncertain").lower()
    reasoning = ai_response.get("reasoning", "External AI evaluation complete.")
    
    # Map label to our expected probability score for fake (0-1)
    # false (fake) -> 1.0 probability of being fake
    # true (real) -> 0.0 probability of being fake
    # uncertain -> 0.5 probability
    if label == "false":
        score = 0.95
    elif label == "true":
        score = 0.05
    else:
        score = 0.5
        
    return {
        "external_ai_score": score,
        "label": label,
        "evidence_used": evidence_used,
        "reasoning": f"External AI: {reasoning}"
    }
