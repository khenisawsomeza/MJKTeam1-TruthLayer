from ddgs import DDGS

try:
    with DDGS() as ddgs:
        res = list(ddgs.text("The earth is flat.", max_results=3))
        print("DDG results:", res)
except Exception as e:
    print("DDG Error:", e)
