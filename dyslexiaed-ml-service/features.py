"""
DyslexiaEd ML Service — Feature Extraction Module

Extracts forensic handwriting features from segmented character crops
and stroke metadata for dyslexia indicator analysis.
"""

import cv2
import numpy as np
from typing import List, Dict, Any
from segmentation import get_inter_char_spacings


def extract_features(char_crops: List[np.ndarray], stroke_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract handwriting features from character crops and timing data.
    
    Returns a feature dictionary with visual, timing, and reversal indicators.
    """
    if not char_crops:
        return _empty_features()
    
    # Visual features
    heights = [get_char_height(c) for c in char_crops]
    widths = [get_char_width(c) for c in char_crops]
    baselines = [get_baseline_position(c) for c in char_crops]
    
    features = {
        # Visual features per character
        "letter_height_variance": float(np.std(heights)) if heights else 0.0,
        "letter_width_variance": float(np.std(widths)) if widths else 0.0,
        "baseline_deviation": float(np.std(baselines)) if baselines else 0.0,
        "spacing_irregularity": _coefficient_of_variation([]),  # placeholder
        "stroke_count_per_char": [count_strokes(c) for c in char_crops],
        
        # Derived stats
        "avg_height": float(np.mean(heights)) if heights else 0.0,
        "avg_width": float(np.mean(widths)) if widths else 0.0,
        "char_count": len(char_crops),
        
        # Timing features from stroke_metadata
        "avg_stroke_duration_ms": float(stroke_metadata.get("totalDuration", 0)) / max(stroke_metadata.get("strokeCount", 1), 1),
        "pause_ratio": _estimate_pause_ratio(stroke_metadata),
        "speed_variance": _estimate_speed_variance(stroke_metadata),
        
        # Reversal candidates
        "reversal_candidates": [],
        "reversal_confidence": [],
    }
    
    # Detect reversal candidates by checking for horizontal symmetry
    for i, crop in enumerate(char_crops):
        symmetry_score = check_horizontal_symmetry(crop)
        if symmetry_score > 0.6:  # High symmetry suggests possible reversal
            features["reversal_candidates"].append(f"char_{i}")
            features["reversal_confidence"].append(float(symmetry_score))
    
    return features


def get_char_height(crop: np.ndarray) -> float:
    """Get the vertical extent of the character (pixels with ink)."""
    rows = np.any(crop > 0, axis=1)
    if not np.any(rows):
        return 0.0
    indices = np.where(rows)[0]
    return float(indices[-1] - indices[0] + 1)


def get_char_width(crop: np.ndarray) -> float:
    """Get the horizontal extent of the character."""
    cols = np.any(crop > 0, axis=0)
    if not np.any(cols):
        return 0.0
    indices = np.where(cols)[0]
    return float(indices[-1] - indices[0] + 1)


def get_baseline_position(crop: np.ndarray) -> float:
    """
    Estimate baseline position as the lowest row with ink,
    normalized to image height.
    """
    rows = np.any(crop > 0, axis=1)
    if not np.any(rows):
        return 0.5
    indices = np.where(rows)[0]
    return float(indices[-1]) / crop.shape[0]


def count_strokes(crop: np.ndarray) -> int:
    """
    Estimate number of strokes by counting connected components
    in the thinned image.
    """
    if crop is None or crop.size == 0:
        return 0
    
    # Thin the character
    try:
        skeleton = cv2.ximgproc.thinning(crop)
    except AttributeError:
        # ximgproc not available, use basic morphology
        kernel = np.ones((3, 3), np.uint8)
        skeleton = cv2.erode(crop, kernel, iterations=1)
    
    num_labels, _ = cv2.connectedComponents(skeleton)
    return max(0, num_labels - 1)  # Subtract background


def check_horizontal_symmetry(crop: np.ndarray) -> float:
    """
    Check if the character is horizontally symmetric (potential reversal).
    Returns a score 0-1 where 1 = perfectly symmetric.
    """
    if crop is None or crop.size == 0:
        return 0.0
    
    h, w = crop.shape
    if w < 4:
        return 0.0
    
    # Flip horizontally
    flipped = cv2.flip(crop, 1)
    
    # Compute normalized cross-correlation
    crop_f = crop.astype(np.float32)
    flipped_f = flipped.astype(np.float32)
    
    norm1 = np.linalg.norm(crop_f)
    norm2 = np.linalg.norm(flipped_f)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    correlation = np.sum(crop_f * flipped_f) / (norm1 * norm2)
    return float(max(0.0, correlation))


def _coefficient_of_variation(values: List[float]) -> float:
    """Compute coefficient of variation (std / mean)."""
    if not values or len(values) < 2:
        return 0.0
    mean = np.mean(values)
    if mean == 0:
        return 0.0
    return float(np.std(values) / mean)


def _estimate_pause_ratio(metadata: Dict[str, Any]) -> float:
    """Estimate the ratio of pause time to total time."""
    total = metadata.get("totalDuration", 0)
    if total == 0:
        return 0.0
    stroke_count = metadata.get("strokeCount", 1)
    avg_speed = metadata.get("avgSpeed", 0.001)
    
    # Heuristic: more strokes with lower speed suggests more pausing
    if stroke_count > 1:
        return min(1.0, 0.1 * (stroke_count - 1) * (1.0 / max(avg_speed, 0.001)))
    return 0.0


def _estimate_speed_variance(metadata: Dict[str, Any]) -> float:
    """Estimate speed variance from available metadata."""
    return float(metadata.get("avgSpeed", 0) * 0.3)  # Heuristic


def _empty_features() -> Dict[str, Any]:
    """Return empty feature set when no characters are detected."""
    return {
        "letter_height_variance": 0.0,
        "letter_width_variance": 0.0,
        "baseline_deviation": 0.0,
        "spacing_irregularity": 0.0,
        "stroke_count_per_char": [],
        "avg_height": 0.0,
        "avg_width": 0.0,
        "char_count": 0,
        "avg_stroke_duration_ms": 0.0,
        "pause_ratio": 0.0,
        "speed_variance": 0.0,
        "reversal_candidates": [],
        "reversal_confidence": [],
    }
