from external_ai import external_ai_score
import json

if __name__ == "__main__":
    print("Testing External AI (Hugging Face + RAG)...")
    result = external_ai_score("The earth is flat.")
    print("\nResult:")
    print(json.dumps(result, indent=2))
