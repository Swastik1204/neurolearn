"""
DyslexiaEd ML Service — Image Preprocessing Module

Handles: Grayscale conversion, Otsu binarization, deskewing,
morphological denoising, and normalization.
"""

import cv2
import numpy as np


def preprocess(image: np.ndarray) -> np.ndarray:
    """
    Full preprocessing pipeline for handwriting images.
    
    Steps:
    1. Convert to grayscale
    2. Apply Otsu binarization
    3. Deskew using Hough line transform
    4. Remove noise with morphological opening
    5. Normalize dimensions
    
    Args:
        image: Input BGR or grayscale image as numpy array
        
    Returns:
        Preprocessed binary image (256x64)
    """
    # 1. Convert to grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # 2. Apply Otsu binarization
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 3. Deskew
    binary = deskew(binary)

    # 4. Remove noise with morphological opening (2x2 kernel)
    kernel = np.ones((2, 2), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # 5. Normalize to 256x64
    binary = cv2.resize(binary, (256, 64), interpolation=cv2.INTER_AREA)

    return binary


def deskew(binary_image: np.ndarray) -> np.ndarray:
    """
    Detect and correct skew angle using Hough line transform.
    """
    # Detect edges
    edges = cv2.Canny(binary_image, 50, 150, apertureSize=3)
    
    # Hough lines
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=50,
        minLineLength=30, maxLineGap=10
    )
    
    if lines is None or len(lines) == 0:
        return binary_image
    
    # Calculate median angle
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 - x1 == 0:
            continue
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        # Only consider near-horizontal lines (likely text baseline)
        if abs(angle) < 30:
            angles.append(angle)
    
    if not angles:
        return binary_image
    
    median_angle = np.median(angles)
    
    # Don't correct very small angles (noise)
    if abs(median_angle) < 0.5:
        return binary_image
    
    # Rotate image
    h, w = binary_image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(
        binary_image, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0
    )
    
    return rotated


def load_image_from_bytes(image_bytes: bytes) -> np.ndarray:
    """Load an image from raw bytes."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img
