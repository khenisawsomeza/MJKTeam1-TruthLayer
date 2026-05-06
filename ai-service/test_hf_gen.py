from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv

load_dotenv()
token = os.environ.get("HUGGINGFACE_API_KEY")

try:
    client = InferenceClient(token=token)
    res = client.text_generation(
        "Claim: The earth is flat.\nEvidence: Earth is a sphere.\nIs the claim true or false? Answer only with 'true' or 'false'.",
        model="HuggingFaceH4/zephyr-7b-beta",
        max_new_tokens=10
    )
    print("Success! Output:", res)
except Exception as e:
    print("Failed:", e)
