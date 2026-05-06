from external_ai import get_duckduckgo_search_results
import json

res = get_duckduckgo_search_results("The earth is flat")
print(json.dumps(res, indent=2))
