# NeuroLearn ML Service - Models Directory

This directory stores the current training outputs used by the local ML service.

## Active Artifacts
- `dyslexia_classifier.pkl` - RandomForest classifier used by `main.py`
- `feature_scaler.pkl` - StandardScaler for feature normalization
- `model_metadata.json` - model version and training metrics
- `dyslexia_cnn.h5` - Keras CNN checkpoint
- `dyslexia_cnn_best.h5` - best Keras CNN checkpoint
- `dyslexia_cnn.tflite` - TFLite export

## Notes
- The API runtime currently loads `dyslexia_classifier.pkl` and `feature_scaler.pkl`.
- Re-training should update these files consistently with `train.py` outputs.
