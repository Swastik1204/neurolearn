"""
NeuroLearn ML Service — FastAPI
Loads trained RandomForest + scaler on startup.
Accepts handwriting images and returns forensic analysis scores.
"""

import os
import io
import json
import httpx
import base64
import joblib
import numpy as np
import cv2
from PIL import Image
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

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
    letter: str = ""  # The specific letter being analyzed
    stroke_metadata: dict = {}

class AnalyzeResponse(BaseModel):
    sample_id: str
    overall_risk: float
    risk_level: str
    letter: str
    scores: dict
    indicators: dict
    letter_specific: dict = {}

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
    bottom = [s[cv2.CC_STAT_TOP] + s[cv2.CC_STAT_HEIGHT] for _, s in valid]
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
        print(f"[ML] Received request for letter: {req.letter}")
        print(f"[ML] image_base64 length: {len(req.image_base64)}")
        
        # 1. Decode base64 image
        try:
            # Handle data:image/png;base64, prefix if present
            encoded = req.image_base64.split(",", 1)[1] if "," in req.image_base64 else req.image_base64
            image_data = base64.b64decode(encoded)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
        
        # 2. Preprocess
        img = preprocess_image_from_bytes(image_data)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not process image")
        
        # 3. Extract features
        raw_features = extract_features(img)
        print(f"[ML] Features extracted successfully")

        # 4. Predict
        if rf_model is not None and scaler is not None:
            feat_array = np.array(raw_features).reshape(1, -1)
            feat_scaled = scaler.transform(feat_array)

            # Predict
            proba = rf_model.predict_proba(feat_scaled)[0]
            risk_proba = float(proba[1])  # probability of dyslexia indicator
            print(f"[ML] RF prediction: {risk_proba}")

            # Incorporate stroke timing metadata
            pause_ratio = req.stroke_metadata.get('pauseRatio', 0)
            speed_variance = req.stroke_metadata.get('speedVariance', 0)
            timing_risk = min(pause_ratio * 0.4 + speed_variance * 0.1, 0.3)
            combined_risk = min(risk_proba * 0.7 + timing_risk, 1.0)
        else:
            # Fallback when model not loaded
            combined_risk = 0.3
            raw_features = [0.0] * 20
            print("[ML] Using fallback risk score (model not loaded)")

        # Compute individual dimension scores (0–100)
        f = raw_features
        letter_form_score = max(0.0, 100.0 - (f[0] * 80.0 + f[1] * 20.0))
        spacing_score = max(0.0, 100.0 - (f[4] * 100.0))
        baseline_score = max(0.0, 100.0 - (f[3] * 150.0))
        reversal_score = min(100.0, (f[14] * 40.0 + abs(f[19] - 1.0) * 60.0))

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

        # Callback to Vercel webhook
        webhook_url = os.getenv("VERCEL_WEBHOOK_URL")
        webhook_secret = os.getenv("ML_WEBHOOK_SECRET")
        
        # Calculate letter_specific logic
        letter_specific = {}
        target_letter = req.letter.lower()
        
        if target_letter in ['b', 'd']:
            # b/d reversals often show high horizontal symmetry (matching their mirror)
            h_sym = float(f[14])
            reversal_val = "High" if h_sym > 0.7 else "Medium" if h_sym > 0.5 else "Low"
            letter_specific = {
                "reversal_risk": reversal_val,
                "note": "Possible b/d confusion detected" if h_sym > 0.7 else None
            }
        elif target_letter in ['p', 'q']:
            # p/q reversals
            h_sym = float(f[14])
            reversal_val = "High" if h_sym > 0.7 else "Medium" if h_sym > 0.5 else "Low"
            letter_specific = {
                "reversal_risk": reversal_val,
                "note": "Possible p/q confusion detected" if h_sym > 0.7 else None
            }
        elif target_letter in ['g', 'y']:
            # g/y confusion often involves descender issues (f[18] is top/bottom ratio)
            desc_ratio = float(f[18])
            quality = "Good" if desc_ratio > 0.8 else "Fair" if desc_ratio > 0.5 else "Needs Practice"
            letter_specific = {
                "descender_quality": quality,
                "note": "Monitor tail formation" if desc_ratio < 0.6 else None
            }
        elif target_letter in ['f', 'h', 'n', 'm']:
            # stroke consistency (f[0] is height std, f[5] is component count)
            consistency = "High" if f[0] < 0.2 else "Medium" if f[0] < 0.4 else "Low"
            letter_specific = {
                "stroke_consistency": consistency,
                "note": "Letter height varies" if f[0] > 0.3 else None
            }

        if webhook_url and webhook_secret:
            payload = {
                "sampleId": req.sample_id,
                "letter": target_letter,
                "scores": {
                    "letterFormScore": round(letter_form_score, 1),
                    "spacingScore": round(spacing_score, 1),
                    "baselineScore": round(baseline_score, 1),
                    "reversalScore": round(reversal_score, 1),
                    "overallRisk": round(combined_risk, 3),
                },
                "indicators": indicators,
                "letter_specific": letter_specific,
                "rawFeatures": {f"f{i}": v for i, v in enumerate(raw_features)},
            }
            try:
                print(f"[ML] Calling webhook at: {webhook_url}")
                async with httpx.AsyncClient() as client:
                    webhook_response = await client.post(
                        webhook_url,
                        json=payload,
                        headers={"X-ML-Secret": webhook_secret},
                        timeout=10
                    )
                print(f"[ML] Webhook response: {webhook_response.status_code}")
            except Exception as e:
                print(f"[ML] Webhook failed: {str(e)}")
                pass  # Don't fail the analysis if webhook fails

        return AnalyzeResponse(
            sample_id=req.sample_id,
            overall_risk=round(combined_risk, 3),
            risk_level=risk_level,
            letter=target_letter,
            scores={
                "letterFormScore": round(letter_form_score, 1),
                "spacingScore": round(spacing_score, 1),
                "baselineScore": round(baseline_score, 1),
                "reversalScore": round(reversal_score, 1),
                "overallRisk": round(combined_risk, 3),
            },
            indicators=indicators,
            letter_specific=letter_specific,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ML] Error in analyze: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
