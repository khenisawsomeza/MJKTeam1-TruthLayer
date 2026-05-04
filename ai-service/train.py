import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

# Enhanced Dataset with more examples
# Fake = 1, Real = 0
data = [
    # FAKE examples (high sensationalism, unverified claims)
    ("SHOCKING: You won't believe what they found hidden in the water supply!!!", 1),
    ("Doctors don't want you to know about this miraculous cure for everything.", 1),
    ("BREAKING: Alien spaceship lands in central park!", 1),
    ("This single mom makes $10,000 a week from home using this one weird trick.", 1),
    ("The government is secretly spying on everyone through smart refrigerators.", 1),
    ("EXCLUSIVE: Celebrity caught doing something UNBELIEVABLE!!!", 1),
    ("Scientists HATE this one simple trick to lose weight!", 1),
    ("WARNING: This food is POISONOUS but they won't tell you!", 1),
    ("You MUST watch this video or you will regret it FOREVER!", 1),
    ("PROOF: The moon landing was completely staged by NASA!", 1),
    
    # REAL examples (factual, verified information)
    ("Local city council approves new budget for park renovations.", 0),
    ("The stock market closed slightly higher today following new job reports.", 0),
    ("Scientists discover a new species of frog in the Amazon rainforest.", 0),
    ("Apple announces the release of their new iPhone next month.", 0),
    ("The local sports team won their game 3-1 yesterday evening.", 0),
    ("New study shows regular exercise improves cardiovascular health.", 0),
    ("The federal reserve announces interest rate decision for next quarter.", 0),
    ("Researchers publish findings on climate change in peer-reviewed journal.", 0),
    ("Company reports quarterly earnings of $2.5 billion.", 0),
    ("City implements new traffic signal system on main street.", 0),
]

texts, labels = zip(*data)

def train_and_save():
    print("Training TruthLayer ML Model...")
    print(f"Dataset size: {len(texts)} examples")
    
    # Enhanced Vectorizer with bigrams and more features
    print("Initializing TfidfVectorizer with ngram_range=(1,2) and max_features=5000...")
    vectorizer = TfidfVectorizer(
        stop_words='english',
        ngram_range=(1, 2),
        max_features=5000,
        min_df=1,
        max_df=0.9
    )
    X = vectorizer.fit_transform(texts)
    print(f"Vectorizer created with {len(vectorizer.get_feature_names_out())} features")
    
    # Improved Model with higher max_iter
    print("Training LogisticRegression model...")
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X, labels)
    
    # Save models
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    joblib.dump(vectorizer, 'vectorizer.pkl')
    joblib.dump(model, 'model.pkl')
    
    print("✓ Model saved to model.pkl")
    print("✓ Vectorizer saved to vectorizer.pkl")
    print("\nTraining complete! Models are ready for predictions.")

if __name__ == "__main__":
    train_and_save()
