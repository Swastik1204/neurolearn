"""
NeuroLearn ML Service — Classifier Module

Hybrid rule-based + ML classifier for dyslexia indicators.
Uses RandomForest on feature vectors for the primary model,
with rule-based reversal detection as a supplementary layer.
"""

import numpy as np
from typing import Dict, Any, List
from sklearn.ensemble import RandomForestClassifier
import joblib
import os


# Known dyslexia reversal pairs
REVERSAL_PAIRS = {
    'b': 'd', 'd': 'b',
    'p': 'q', 'q': 'p',
    'n': 'u', 'u': 'n',
}

# Common word-level reversals
WORD_REVERSALS = {
    'was': 'saw', 'saw': 'was',
    'on': 'no', 'no': 'on',
    'tap': 'pat', 'pat': 'tap',
    'bid': 'dib', 'dib': 'bid',
}


class DyslexiaClassifier:
    """Hybrid rule-based + ML classifier for handwriting analysis."""
    
    def __init__(self, model_path: str = None):
        self.model = None
        if model_path and os.path.exists(model_path):
            self.model = joblib.load(model_path)
        else:
            # Create a default model with synthetic training
            self.model = self._create_default_model()
    
    def _create_default_model(self) -> RandomForestClassifier:
        """
        Create a RandomForest classifier trained on synthetic features.
        In production, this would be trained on real labeled data.
        """
        np.random.seed(42)
        n_samples = 200
        
        # Generate synthetic feature vectors
        # Features: [height_var, width_var, baseline_dev, spacing_irreg,
        #            avg_stroke_dur, pause_ratio, speed_var, char_count,
        #            reversal_count, symmetry_score]
        
        # Normal writing (low risk)
        normal = np.random.normal(
            [3, 2, 0.05, 0.1, 200, 0.1, 0.3, 4, 0, 0.3],
            [1, 1, 0.02, 0.05, 50, 0.05, 0.1, 1, 0.5, 0.1],
            (n_samples // 2, 10)
        )
        normal_labels = np.zeros(n_samples // 2)
        
        # Dyslexic indicators (high risk)
        dyslexic = np.random.normal(
            [8, 6, 0.15, 0.3, 400, 0.3, 0.7, 3, 2, 0.7],
            [2, 2, 0.05, 0.1, 100, 0.1, 0.2, 1, 1, 0.1],
            (n_samples // 2, 10)
        )
        dyslexic_labels = np.ones(n_samples // 2)
        
        X = np.vstack([normal, dyslexic])
        y = np.concatenate([normal_labels, dyslexic_labels])
        
        model = RandomForestClassifier(
            n_estimators=50, max_depth=8, random_state=42
        )
        model.fit(X, y)
        
        return model
    
    def classify(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run classification on extracted features.
        Returns scores and indicator lists.
        """
        # Prepare feature vector for ML model
        feature_vector = self._features_to_vector(features)
        
        # ML prediction
        ml_risk = 0.0
        if self.model is not None:
            try:
                ml_risk = float(self.model.predict_proba(
                    feature_vector.reshape(1, -1)
                )[0][1])
            except Exception:
                ml_risk = 0.3  # Default moderate risk on error
        
        # Rule-based scores
        letter_form_score = self._score_letter_form(features)
        spacing_score = self._score_spacing(features)
        baseline_score = self._score_baseline(features)
        reversal_score = self._score_reversals(features)
        
        # Combine ML and rule-based
        rule_risk = (
            (100 - letter_form_score) * 0.25 +
            (100 - spacing_score) * 0.15 +
            (100 - baseline_score) * 0.15 +
            reversal_score * 0.45
        ) / 100
        
        overall_risk = 0.6 * ml_risk + 0.4 * rule_risk
        overall_risk = max(0.0, min(1.0, overall_risk))
        
        # Build indicator lists
        indicators = self._build_indicators(features)
        
        return {
            "letter_form_score": round(letter_form_score, 1),
            "spacing_score": round(spacing_score, 1),
            "baseline_score": round(baseline_score, 1),
            "reversal_score": round(reversal_score, 1),
            "overall_dyslexia_risk": round(overall_risk, 3),
            "indicators": indicators,
        }
    
    def _features_to_vector(self, features: Dict[str, Any]) -> np.ndarray:
        """Convert feature dict to numpy vector for ML model."""
        reversal_count = len(features.get("reversal_candidates", []))
        max_symmetry = max(features.get("reversal_confidence", [0.0])) if features.get("reversal_confidence") else 0.0
        
        return np.array([
            features.get("letter_height_variance", 0),
            features.get("letter_width_variance", 0),
            features.get("baseline_deviation", 0),
            features.get("spacing_irregularity", 0),
            features.get("avg_stroke_duration_ms", 0),
            features.get("pause_ratio", 0),
            features.get("speed_variance", 0),
            features.get("char_count", 0),
            reversal_count,
            max_symmetry,
        ], dtype=np.float64)
    
    def _score_letter_form(self, features: Dict[str, Any]) -> float:
        """Score letter formation quality (0-100, higher = better)."""
        height_var = features.get("letter_height_variance", 0)
        width_var = features.get("letter_width_variance", 0)
        
        # Lower variance = better letter form
        score = 100 - min(100, (height_var * 5) + (width_var * 3))
        return max(0, score)
    
    def _score_spacing(self, features: Dict[str, Any]) -> float:
        """Score spacing consistency (0-100, higher = better)."""
        irregularity = features.get("spacing_irregularity", 0)
        score = 100 - min(100, irregularity * 200)
        return max(0, score)
    
    def _score_baseline(self, features: Dict[str, Any]) -> float:
        """Score baseline consistency (0-100, higher = better)."""
        deviation = features.get("baseline_deviation", 0)
        score = 100 - min(100, deviation * 300)
        return max(0, score)
    
    def _score_reversals(self, features: Dict[str, Any]) -> float:
        """Score reversal frequency (0-100, higher = MORE reversals = risk)."""
        candidates = features.get("reversal_candidates", [])
        confidences = features.get("reversal_confidence", [])
        
        if not candidates:
            return 0.0
        
        # Weight by confidence
        weighted_count = sum(c for c in confidences if c > 0.5)
        score = min(100, weighted_count * 30)
        return score
    
    def _build_indicators(self, features: Dict[str, Any]) -> Dict[str, List]:
        """Build detailed indicator lists."""
        candidates = features.get("reversal_candidates", [])
        confidences = features.get("reversal_confidence", [])
        
        reversals = []
        for i, (char, conf) in enumerate(zip(candidates, confidences)):
            if conf > 0.5:
                reversals.append({
                    "char": char,
                    "position": i,
                    "confidence": round(conf, 3),
                })
        
        # Detect omissions (missing strokes)
        omissions = []
        stroke_counts = features.get("stroke_count_per_char", [])
        for i, count in enumerate(stroke_counts):
            if count == 0:
                omissions.append({
                    "position": i,
                    "type": "missing_strokes",
                })
        
        return {
            "reversals": reversals,
            "omissions": omissions,
            "substitutions": [],
            "sequencing_errors": [],
        }
    
    def save_model(self, path: str):
        """Save the trained model to disk."""
        if self.model:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            joblib.dump(self.model, path)


# Global classifier instance
_classifier = None

def get_classifier() -> DyslexiaClassifier:
    """Get or create the global classifier instance."""
    global _classifier
    if _classifier is None:
        model_path = os.path.join(
            os.path.dirname(__file__), "models", "classifier.pkl"
        )
        _classifier = DyslexiaClassifier(model_path)
    return _classifier
