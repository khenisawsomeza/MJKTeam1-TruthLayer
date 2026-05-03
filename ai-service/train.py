import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

# Sample Dataset
# Fake = 1, Real = 0
data = [
    ("SHOCKING: You won't believe what they found hidden in the water supply!!!", 1),
    ("Doctors don't want you to know about this miraculous cure for everything.", 1),
    ("BREAKING: Alien spaceship lands in central park!", 1),
    ("This single mom makes $10,000 a week from home using this one weird trick.", 1),
    ("The government is secretly spying on everyone through smart refrigerators.", 1),
    ("Local city council approves new budget for park renovations.", 0),
    ("The stock market closed slightly higher today following new job reports.", 0),
    ("Scientists discover a new species of frog in the Amazon rainforest.", 0),
    ("Apple announces the release of their new iPhone next month.", 0),
    ("The local sports team won their game 3-1 yesterday evening.", 0)
]

texts, labels = zip(*data)

def train_and_save():
    print("Training model...")
    # Vectorizer
    vectorizer = TfidfVectorizer(stop_words='english')
    X = vectorizer.fit_transform(texts)
    
    # Model
    model = LogisticRegression()
    model.fit(X, labels)
    
    # Save
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    joblib.dump(vectorizer, 'vectorizer.pkl')
    joblib.dump(model, 'model.pkl')
    
    print("Model and vectorizer saved successfully.")

if __name__ == "__main__":
    train_and_save()
