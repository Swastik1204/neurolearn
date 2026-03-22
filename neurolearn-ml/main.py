"""
NeuroLearn ML Service — FastAPI Application

Endpoints:
- POST /analyze — Analyze a handwriting sample image
- GET /health — Health check
"""

import os
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import httpx
import numpy as np

from preprocess import preprocess, load_image_from_bytes
from segmentation import segment_characters
from features import extract_features
from classifier import get_classifier

app = FastAPI(
    title="NeuroLearn ML Service",
    description="Handwriting analysis for dyslexia indicator detection",
    version="1.0.0",
)

# Configuration
VERCEL_WEBHOOK_URL = os.getenv("VERCEL_WEBHOOK_URL", "")
ML_WEBHOOK_SECRET = os.getenv("ML_WEBHOOK_SECRET", "dev-secret")


class AnalyzeRequest(BaseModel):
    image_url: str
    sample_id: str
    stroke_metadata: Dict[str, Any] = {}


class AnalyzeResponse(BaseModel):
    sample_id: str
    status: str
    scores: Optional[Dict[str, Any]] = None
    indicators: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    classifier = get_classifier()
    return HealthResponse(
        status="ok",
        model_loaded=classifier.model is not None,
    )


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """
    Analyze a handwriting sample image for dyslexia indicators.
    
    Pipeline:
    1. Download image from URL
    2. Preprocess (grayscale, binarize, deskew, denoise)
    3. Segment characters
    4. Extract features
    5. Classify
    6. Send results to webhook
    """
    try:
        # Step 0: Download image
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(request.image_url)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not download image: HTTP {response.status_code}"
                )
            image_bytes = response.content

        # Step 1: Preprocess
        image = load_image_from_bytes(image_bytes)
        binary = preprocess(image)

        # Step 2: Segment characters
        char_crops = segment_characters(binary)

        # Step 3: Extract features
        features = extract_features(char_crops, request.stroke_metadata)

        # Step 4: Classify
        classifier = get_classifier()
        result = classifier.classify(features)

        # Step 5: Send results to webhook
        if VERCEL_WEBHOOK_URL:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    webhook_response = await client.post(
                        VERCEL_WEBHOOK_URL,
                        json={
                            "sampleId": request.sample_id,
                            "scores": {
                                "letter_form_score": result["letter_form_score"],
                                "spacing_score": result["spacing_score"],
                                "baseline_score": result["baseline_score"],
                                "reversal_score": result["reversal_score"],
                                "overall_dyslexia_risk": result["overall_dyslexia_risk"],
                            },
                            "indicators": result["indicators"],
                            "rawFeatures": {
                                k: v for k, v in features.items()
                                if isinstance(v, (int, float, str, list))
                            },
                        },
                        headers={
                            "X-ML-Secret": ML_WEBHOOK_SECRET,
                            "Content-Type": "application/json",
                        },
                    )
                    if webhook_response.status_code != 200:
                        print(f"Webhook returned {webhook_response.status_code}")
            except Exception as webhook_error:
                print(f"Webhook call failed: {webhook_error}")
                # Non-fatal — results are still returned in the response

        return AnalyzeResponse(
            sample_id=request.sample_id,
            status="complete",
            scores={
                "letter_form_score": result["letter_form_score"],
                "spacing_score": result["spacing_score"],
                "baseline_score": result["baseline_score"],
                "reversal_score": result["reversal_score"],
                "overall_dyslexia_risk": result["overall_dyslexia_risk"],
            },
            indicators=result["indicators"],
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Analysis error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "service": "NeuroLearn ML Service",
        "version": "1.0.0",
        "endpoints": {
            "/analyze": "POST - Analyze handwriting sample",
            "/health": "GET - Health check",
        }
    }
