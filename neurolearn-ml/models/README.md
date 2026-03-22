# NeuroLearn ML Service — Models Directory

This directory stores trained model files.

## Files
- `classifier.pkl` — Trained RandomForest classifier (auto-generated on first run if missing)

## Training
The classifier ships with a synthetic training set. To train on real data:
1. Collect labeled handwriting samples (minimum 500 per class)
2. Run the feature extraction pipeline on each sample
3. Train with `sklearn.ensemble.RandomForestClassifier`
4. Save with `joblib.dump(model, "classifier.pkl")`
