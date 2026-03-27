"""
NeuroLearn ML Service — FastAPI
Loads trained RandomForest + scaler on startup.
Accepts handwriting images and returns forensic analysis scores.
"""

import os
import io
import json
import base64 as _base64
import httpx
import joblib
import numpy as np
import cv2
from PIL import Image
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="NeuroLearn ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load models on startup ────────────────────────────────────────────────────
MODELS_PATH = Path("models")
rf_model = None
scaler = None
metadata = {}

@app.on_event("startup")
async def load_models():
    global rf_model, scaler, metadata
    try:
        rf_model = joblib.load(MODELS_PATH / "dyslexia_classifier.pkl")
        scaler = joblib.load(MODELS_PATH / "feature_scaler.pkl")
        with open(MODELS_PATH / "model_metadata.json") as f:
            metadata = json.load(f)
        print(f"Models loaded — RF accuracy: {metadata.get('rf_accuracy', 'unknown')}")
    except Exception as e:
        print(f"Warning: Could not load models: {e}")
        print("Service will run but analysis will return placeholder scores")

# ── Request/Response models ───────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    image_base64: str
    sample_id: str
    student_id: str
    letter: str = ""
    stroke_metadata: dict = {}

class AnalyzeResponse(BaseModel):
    sample_id: str
    student_id: str
    letter: str
    scores: dict
    indicators: dict
    letter_specific: dict
    overall_risk: float
    risk_level: str

# ── Image preprocessing (same as training) ────────────────────────────────────
def preprocess_image_from_bytes(img_bytes):
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) < 10:
        return cv2.resize(binary, (32, 32))
    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    (h, w) = binary.shape
    M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
    deskewed = cv2.warpAffine(binary, M, (w, h), flags=cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_REPLICATE)
    kernel = np.ones((2, 2), np.uint8)
    denoised = cv2.morphologyEx(deskewed, cv2.MORPH_OPEN, kernel)
    return cv2.resize(denoised, (32, 32))

def extract_features(img):
    """Same feature extraction as train.py."""
    if img is None:
        return None
    features = []
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(img)
    valid = [(i, stats[i]) for i in range(1, num_labels)
             if 50 < stats[i][cv2.CC_STAT_AREA] < 2000]
    if len(valid) < 2:
        return [0.0] * 20

    areas = [s[cv2.CC_STAT_AREA] for _, s in valid]
    heights = [s[cv2.CC_STAT_HEIGHT] for _, s in valid]
    widths = [s[cv2.CC_STAT_WIDTH] for _, s in valid]
    x_pos = [s[cv2.CC_STAT_LEFT] for _, s in valid]
    y_pos = [s[cv2.CC_STAT_TOP] for _, s in valid]

    features.append(np.std(heights) / (np.mean(heights) + 1e-6))
    features.append(np.std(widths) / (np.mean(widths) + 1e-6))
    features.append(np.std(areas) / (np.mean(areas) + 1e-6))
    bottom = [y + s[cv2.CC_STAT_HEIGHT] for _, s in valid]
    features.append(np.std(bottom) / (32 + 1e-6))
    gaps = np.diff(sorted(x_pos)) if len(x_pos) > 1 else [0]
    features.append(np.std(gaps) / (np.mean(gaps) + 1e-6))
    features.append(min(len(valid), 15))
    features.append(len(valid) / 4.0)
    aspects = [w / (h + 1e-6) for w, h in zip(widths, heights)]
    features.append(np.mean(aspects))
    features.append(np.std(aspects))
    features.append(np.sum(img > 0) / (32 * 32))
    features.append(np.var(np.sum(img, axis=1) / 255.0))
    features.append(np.var(np.sum(img, axis=0) / 255.0))
    dt = cv2.distanceTransform(img, cv2.DIST_L2, 5)
    features.append(np.mean(dt[dt > 0]) if np.any(dt > 0) else 0)
    features.append(np.std(dt[dt > 0]) if np.any(dt > 0) else 0)
    flipped = cv2.flip(img, 1)
    diff = cv2.absdiff(img, flipped)
    features.append(1.0 - np.sum(diff > 0) / (32 * 32))
    flipped_v = cv2.flip(img, 0)
    diff_v = cv2.absdiff(img, flipped_v)
    features.append(1.0 - np.sum(diff_v > 0) / (32 * 32))
    corners = cv2.goodFeaturesToTrack(img, 50, 0.01, 5)
    features.append(len(corners) if corners is not None else 0)
    contours, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        lc = max(contours, key=cv2.contourArea)
        p = cv2.arcLength(lc, True)
        a = cv2.contourArea(lc)
        features.append((p**2) / (4 * np.pi * a + 1e-6))
    else:
        features.append(0.0)
    mid = 16
    features.append(np.sum(img[:mid] > 0) / (np.sum(img[mid:] > 0) + 1e-6))
    midw = 16
    features.append(np.sum(img[:, :midw] > 0) / (np.sum(img[:, midw:] > 0) + 1e-6))
    return features

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": rf_model is not None,
        "model_version": metadata.get("model_version", "unknown"),
        "rf_accuracy": metadata.get("rf_accuracy", "unknown")
    }

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    try:
        raw = req.image_base64
        encoded = raw.split(",", 1)[1] if "," in raw else raw
        img_bytes = _base64.b64decode(encoded)

        # Preprocess
        img = preprocess_image_from_bytes(img_bytes)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not process image")

        # Extract features
        raw_features = extract_features(img)

        if rf_model is not None and scaler is not None:
            # Scale features
            feat_array = np.array(raw_features).reshape(1, -1)
            feat_scaled = scaler.transform(feat_array)

            # Predict
            proba = rf_model.predict_proba(feat_scaled)[0]
            risk_proba = float(proba[1])  # probability of dyslexia indicator

            # Incorporate stroke timing metadata
            pause_ratio = req.stroke_metadata.get('pauseRatio', 0)
            speed_variance = req.stroke_metadata.get('speedVariance', 0)
            timing_risk = min(pause_ratio * 0.4 + speed_variance * 0.1, 0.3)
            combined_risk = min(risk_proba * 0.7 + timing_risk, 1.0)
        else:
            # Fallback when model not loaded
            combined_risk = 0.3
            raw_features = [0.0] * 20

        # Compute individual dimension scores (0–100)
        f = raw_features
        letter_form_score = max(0, 100 - (f[0] * 80 + f[1] * 20))
        spacing_score = max(0, 100 - (f[4] * 100))
        baseline_score = max(0, 100 - (f[3] * 150))
        reversal_score = min(100, (f[14] * 40 + abs(f[19] - 1.0) * 60))

        # Build indicators
        indicators = {
            "reversals": [{"confidence": float(f[14]), "type": "horizontal_symmetry"}]
                         if f[14] > 0.7 else [],
            "baselineDrift": float(f[3]) > 0.3,
            "sizingInconsistency": float(f[0]) > 0.4,
            "spacingIrregularity": float(f[4]) > 0.5,
            "omissionRisk": float(f[6]) < 0.5,
        }

        risk_level = (
            "high" if combined_risk > 0.65 else
            "medium" if combined_risk > 0.35 else
            "low"
        )

        # Letter diagnostics used by API clients and webhook payload.
        target_letter = (req.letter or "").lower()
        if target_letter in ['b', 'd']:
            h_sym = float(f[14])
            reversal_val = "High" if h_sym > 0.7 else "Medium" if h_sym > 0.4 else "Low"
            letter_specific = {
                "reversal_risk": reversal_val,
                "note": f"Handwriting shows potential {target_letter} reversal patterns." if h_sym > 0.5 else "Standard form."
            }
        elif target_letter in ['g', 'y', 'p', 'q', 'j']:
            v_var = float(f[11])
            descender_val = "Consistent" if v_var > 0.3 else "Short/Inconsistent"
            letter_specific = {
                "descender_quality": descender_val,
                "note": "Descenders are well-formed." if v_var > 0.3 else "Focus on extending tails below the line."
            }
        else:
            letter_specific = {
                "general_form": "Good alignment" if f[3] < 0.2 else "Needs baseline focus"
            }

        # Callback to Vercel webhook
        enable_webhook = os.getenv("ENABLE_ML_WEBHOOK", "false").lower() == "true"
        webhook_url = os.getenv("VERCEL_WEBHOOK_URL", "https://neurolearn-api.vercel.app/api/webhook/ml-result")
        webhook_secret = os.getenv("ML_WEBHOOK_SECRET")
        if enable_webhook and webhook_url and webhook_secret:
            payload = {
                "sample_id": req.sample_id,
                "student_id": req.student_id,
                "letter": req.letter,
                "scores": {
                    "letterFormScore": round(letter_form_score, 1),
                    "spacingScore": round(spacing_score, 1),
                    "baselineScore": round(baseline_score, 1),
                    "reversalScore": round(reversal_score, 1),
                    "overallRisk": round(combined_risk, 3),
                },
                "indicators": indicators,
                "letter_specific": letter_specific,
                "overall_risk": round(combined_risk, 3),
                "risk_level": risk_level,
                "rawFeatures": {f"f{i}": v for i, v in enumerate(raw_features)},
            }
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        webhook_url,
                        json=payload,
                        headers={"X-ML-Secret": webhook_secret},
                        timeout=10
                    )
            except Exception:
                pass  # Don't fail the analysis if webhook fails

        return AnalyzeResponse(
            sample_id=req.sample_id,
            student_id=req.student_id,
            letter=req.letter,
            scores={
                "letterFormScore": round(letter_form_score, 1),
                "spacingScore": round(spacing_score, 1),
                "baselineScore": round(baseline_score, 1),
                "reversalScore": round(reversal_score, 1),
                "overallRisk": round(combined_risk, 3),
            },
            indicators=indicators,
            letter_specific=letter_specific,
            overall_risk=round(combined_risk, 3),
            risk_level=risk_level,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
