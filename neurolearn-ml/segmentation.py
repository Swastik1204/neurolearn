"""
NeuroLearn ML Service — Character Segmentation Module

Uses connected components analysis to isolate individual characters
from preprocessed binary handwriting images.
"""

import cv2
import numpy as np
from typing import List, Tuple


def segment_characters(binary: np.ndarray) -> List[np.ndarray]:
    """
    Segment individual characters from a binary handwriting image.
    
    Uses connected components analysis with filtering by area.
    Returns character crops sorted left-to-right, each normalized to 32x32.
    
    Args:
        binary: Preprocessed binary image (white text on black background)
        
    Returns:
        List of 32x32 character crop arrays
    """
    # Connected components analysis
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )
    
    # Filter components by area
    MIN_AREA = 50
    MAX_AREA = 5000
    
    components = []
    for i in range(1, num_labels):  # Skip background (label 0)
        area = stats[i, cv2.CC_STAT_AREA]
        if MIN_AREA <= area <= MAX_AREA:
            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]
            cx = centroids[i][0]
            
            components.append({
                'bbox': (x, y, w, h),
                'area': area,
                'centroid_x': cx,
                'label': i,
            })
    
    # Sort left-to-right by centroid x position
    components.sort(key=lambda c: c['centroid_x'])
    
    # Merge nearby components that might be parts of the same character
    merged = merge_close_components(components, binary.shape[1])
    
    # Extract and normalize crops
    crops = []
    for comp in merged:
        x, y, w, h = comp['bbox']
        
        # Add small padding
        pad = 3
        x = max(0, x - pad)
        y = max(0, y - pad)
        w = min(binary.shape[1] - x, w + 2 * pad)
        h = min(binary.shape[0] - y, h + 2 * pad)
        
        crop = binary[y:y+h, x:x+w]
        
        # Normalize to 32x32 maintaining aspect ratio
        normalized = normalize_crop(crop, target_size=32)
        crops.append(normalized)
    
    return crops


def merge_close_components(
    components: List[dict], 
    image_width: int, 
    merge_threshold_ratio: float = 0.02
) -> List[dict]:
    """
    Merge components that are very close horizontally (likely parts of same character,
    e.g., the dot on 'i' or 'j').
    """
    if len(components) <= 1:
        return components
    
    merge_threshold = image_width * merge_threshold_ratio
    merged = [components[0]]
    
    for comp in components[1:]:
        prev = merged[-1]
        prev_right = prev['bbox'][0] + prev['bbox'][2]
        curr_left = comp['bbox'][0]
        
        # Check if this component overlaps or is very close to previous
        if curr_left - prev_right < merge_threshold:
            # Merge bounding boxes
            x1 = min(prev['bbox'][0], comp['bbox'][0])
            y1 = min(prev['bbox'][1], comp['bbox'][1])
            x2 = max(prev['bbox'][0] + prev['bbox'][2], comp['bbox'][0] + comp['bbox'][2])
            y2 = max(prev['bbox'][1] + prev['bbox'][3], comp['bbox'][1] + comp['bbox'][3])
            
            merged[-1] = {
                'bbox': (x1, y1, x2 - x1, y2 - y1),
                'area': prev['area'] + comp['area'],
                'centroid_x': (prev['centroid_x'] + comp['centroid_x']) / 2,
                'label': prev['label'],
            }
        else:
            merged.append(comp)
    
    return merged


def normalize_crop(crop: np.ndarray, target_size: int = 32) -> np.ndarray:
    """
    Normalize a character crop to target_size x target_size 
    while maintaining aspect ratio.
    """
    h, w = crop.shape[:2]
    
    if h == 0 or w == 0:
        return np.zeros((target_size, target_size), dtype=np.uint8)
    
    # Calculate scale to fit in target_size while maintaining ratio
    scale = min(target_size / w, target_size / h) * 0.8  # 80% fill
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    
    resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    # Center in target_size x target_size canvas
    canvas = np.zeros((target_size, target_size), dtype=np.uint8)
    x_offset = (target_size - new_w) // 2
    y_offset = (target_size - new_h) // 2
    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized
    
    return canvas


def get_inter_char_spacings(components: List[dict]) -> List[float]:
    """
    Calculate spacing between consecutive character bounding boxes.
    """
    spacings = []
    for i in range(1, len(components)):
        prev_right = components[i-1]['bbox'][0] + components[i-1]['bbox'][2]
        curr_left = components[i]['bbox'][0]
        spacings.append(max(0, curr_left - prev_right))
    return spacings
