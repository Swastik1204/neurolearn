# NeuroLearn ML Service — Templates Directory

This directory stores reference character images for reversal detection.

## Usage
Template matching compares student handwriting against correctly-oriented
reference characters using normalized cross-correlation.

## File naming convention
- `b_reference.png` — Correctly oriented 'b'
- `d_reference.png` — Correctly oriented 'd'
- `p_reference.png` — Correctly oriented 'p'
- `q_reference.png` — Correctly oriented 'q'

Each template should be:
- 32x32 pixels
- Binary (black on white)
- Centered within the frame
