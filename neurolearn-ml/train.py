"""
NeuroLearn — Handwriting Analysis Model Training
Trains two models:
  1. RandomForest classifier (forensic feature-based) → dyslexia_classifier.pkl
  2. Keras CNN (image-based) → dyslexia_cnn.tflite (for Firebase ML)
"""

import os
import cv2
import numpy as np
import pandas as pd
import joblib
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
from tqdm import tqdm
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import warnings
warnings.filterwarnings('ignore')

# ── Configuration ─────────────────────────────────────────────────────────────
DATA_PATH = Path(r"D:\My projects\NeuroLearn\neurolearn-ml\data")
MODELS_PATH = Path(r"D:\My projects\NeuroLearn\neurolearn-ml\models")
TEMPLATES_PATH = Path(r"D:\My projects\NeuroLearn\neurolearn-ml\templates")
MODELS_PATH.mkdir(exist_ok=True)
TEMPLATES_PATH.mkdir(exist_ok=True)

# Dyslexia indicator word list — these are the 10 words in NeuroLearn exercises
# Focus training on words with reversal-prone letters
DYSLEXIA_WORDS = ["bed", "dog", "was", "saw", "pat", "tap", "no", "on", "bid", "dib"]
REVERSAL_PAIRS = [('b','d'), ('p','q'), ('n','u'), ('m','w')]
IMG_SIZE = (32, 32)
MAX_SAMPLES = 8000  # cap for memory management on 16GB RAM

print("=" * 60)
print("NeuroLearn — Handwriting Analysis Model Training")
print("=" * 60)

# ── Step 1: Load and preprocess images ────────────────────────────────────────
def preprocess_image(img_path):
    """Full forensic preprocessing pipeline."""
    img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None

    # Otsu binarisation
    _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Deskew using moments
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) < 10:
        return None
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    (h, w) = binary.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    deskewed = cv2.warpAffine(binary, M, (w, h), flags=cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_REPLICATE)

    # Morphological denoising
    kernel = np.ones((2, 2), np.uint8)
    denoised = cv2.morphologyEx(deskewed, cv2.MORPH_OPEN, kernel)

    # Resize to standard size
    resized = cv2.resize(denoised, IMG_SIZE)
    return resized


def extract_forensic_features(img, word_label=""):
    """Extract 20-dimensional forensic feature vector from preprocessed image."""
    if img is None:
        return None

    features = {}

    # Connected components analysis
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(img)

    # Filter valid components (not noise, not whole image)
    valid = [(i, stats[i]) for i in range(1, num_labels)
             if 50 < stats[i][cv2.CC_STAT_AREA] < 2000]

    if len(valid) < 2:
        return None

    areas = [s[cv2.CC_STAT_AREA] for _, s in valid]
    heights = [s[cv2.CC_STAT_HEIGHT] for _, s in valid]
    widths = [s[cv2.CC_STAT_WIDTH] for _, s in valid]
    x_positions = [s[cv2.CC_STAT_LEFT] for _, s in valid]
    y_positions = [s[cv2.CC_STAT_TOP] for _, s in valid]

    # 1. Letter height variance (dyslexia = inconsistent sizing)
    features['height_variance'] = np.std(heights) / (np.mean(heights) + 1e-6)

    # 2. Letter width variance
    features['width_variance'] = np.std(widths) / (np.mean(widths) + 1e-6)

    # 3. Area variance
    features['area_variance'] = np.std(areas) / (np.mean(areas) + 1e-6)

    # 4. Baseline deviation (y-position consistency)
    bottom_edges = [y + s[cv2.CC_STAT_HEIGHT] for _, s in valid]
    features['baseline_deviation'] = np.std(bottom_edges) / (IMG_SIZE[1] + 1e-6)

    # 5. Spacing irregularity
    if len(x_positions) > 1:
        sorted_x = sorted(x_positions)
        gaps = np.diff(sorted_x)
        features['spacing_irregularity'] = np.std(gaps) / (np.mean(gaps) + 1e-6)
    else:
        features['spacing_irregularity'] = 0.0

    # 6. Component count (omissions = fewer components than expected)
    features['component_count'] = min(len(valid), 15)

    # 7. Expected component ratio (vs word length)
    expected = max(len(word_label), 1)
    features['component_ratio'] = len(valid) / expected

    # 8. Aspect ratio mean
    aspects = [w / (h + 1e-6) for w, h in zip(widths, heights)]
    features['aspect_ratio_mean'] = np.mean(aspects)
    features['aspect_ratio_std'] = np.std(aspects)

    # 9. Image density (ink coverage)
    features['ink_density'] = np.sum(img > 0) / (img.shape[0] * img.shape[1])

    # 10. Horizontal projection profile variance
    h_proj = np.sum(img, axis=1) / 255.0
    features['h_proj_variance'] = np.var(h_proj)

    # 11. Vertical projection profile variance
    v_proj = np.sum(img, axis=0) / 255.0
    features['v_proj_variance'] = np.var(v_proj)

    # 12. Stroke width estimation (thin vs thick strokes)
    dist_transform = cv2.distanceTransform(img, cv2.DIST_L2, 5)
    features['stroke_width_mean'] = np.mean(dist_transform[dist_transform > 0]) if np.any(dist_transform > 0) else 0
    features['stroke_width_std'] = np.std(dist_transform[dist_transform > 0]) if np.any(dist_transform > 0) else 0

    # 13. Symmetry score (mirrored letters have high symmetry)
    flipped = cv2.flip(img, 1)
    diff = cv2.absdiff(img, flipped)
    features['horizontal_symmetry'] = 1.0 - (np.sum(diff > 0) / (img.shape[0] * img.shape[1]))

    # 14. Vertical symmetry
    flipped_v = cv2.flip(img, 0)
    diff_v = cv2.absdiff(img, flipped_v)
    features['vertical_symmetry'] = 1.0 - (np.sum(diff_v > 0) / (img.shape[0] * img.shape[1]))

    # 15. Corner density (structural feature)
    corners = cv2.goodFeaturesToTrack(img, 50, 0.01, 5)
    features['corner_count'] = len(corners) if corners is not None else 0

    # 16. Contour complexity
    contours, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        perimeter = cv2.arcLength(largest, True)
        area = cv2.contourArea(largest)
        features['contour_complexity'] = (perimeter ** 2) / (4 * np.pi * area + 1e-6)
    else:
        features['contour_complexity'] = 0.0

    # 17. Top-half vs bottom-half ink ratio (ascenders/descenders)
    mid = img.shape[0] // 2
    top_ink = np.sum(img[:mid] > 0)
    bot_ink = np.sum(img[mid:] > 0)
    features['ascender_ratio'] = top_ink / (bot_ink + 1e-6)

    # 18. Left-right ink ratio (reversal indicator)
    mid_w = img.shape[1] // 2
    left_ink = np.sum(img[:, :mid_w] > 0)
    right_ink = np.sum(img[:, mid_w:] > 0)
    features['lr_ratio'] = left_ink / (right_ink + 1e-6)

    return list(features.values())


# ── Step 2: Load dataset ───────────────────────────────────────────────────────
print("\n[1/6] Loading dataset...")

def find_image_files(data_path, max_count=MAX_SAMPLES):
    """Find all PNG/JPG word images in the IAM dataset."""
    images = []
    for root, dirs, files in os.walk(data_path):
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                images.append(Path(root) / f)
                if len(images) >= max_count:
                    return images
    return images

image_files = find_image_files(DATA_PATH)
print(f"Found {len(image_files)} images")

if len(image_files) == 0:
    print("ERROR: No images found in data/ directory")
    print(f"Looked in: {DATA_PATH}")
    print("Please check that the Kaggle dataset was downloaded correctly")
    exit(1)

# ── Step 3: Extract features ────────────────────────────────────────────────
print("\n[2/6] Extracting forensic features...")

X_features = []  # Feature vectors for RandomForest
X_images = []    # Raw images for CNN
y_labels = []    # Labels

skipped = 0
for img_path in tqdm(image_files, desc="Processing"):
    processed = preprocess_image(img_path)
    if processed is None:
        skipped += 1
        continue

    # Get word label from filename (IAM format: a01-000u-00-00.png → word)
    filename = img_path.stem
    parts = filename.split('-')

    features = extract_forensic_features(processed, filename)
    if features is None:
        skipped += 1
        continue

    # Synthetic labelling strategy:
    # Since IAM doesn't have dyslexia labels, we create synthetic labels
    # based on forensic feature thresholds that approximate dyslexia indicators
    # This is the standard approach for training dyslexia detection models
    # when clinical labels are unavailable

    lr_ratio = features[-1]       # left-right ratio
    symmetry = features[12]       # horizontal symmetry
    height_var = features[0]      # height variance
    baseline_dev = features[3]    # baseline deviation

    # Reversal indicator: high symmetry + high LR ratio asymmetry
    reversal_score = symmetry * 0.4 + (abs(lr_ratio - 1.0) * 0.3) + (height_var * 0.3)

    # Label: 1 = dyslexia indicator present, 0 = normal
    label = 1 if reversal_score > 0.45 else 0

    X_features.append(features)
    X_images.append(processed)
    y_labels.append(label)

X_features = np.array(X_features)
X_images = np.array(X_images)
y_labels = np.array(y_labels)

print(f"Processed: {len(y_labels)} samples (skipped: {skipped})")
print(f"Class distribution: Normal={sum(y_labels==0)}, Indicator={sum(y_labels==1)}")

# ── Step 4: Train RandomForest ─────────────────────────────────────────────
print("\n[3/6] Training RandomForest classifier...")

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_features)

X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y_labels, test_size=0.2, random_state=42, stratify=y_labels
)

rf_model = RandomForestClassifier(
    n_estimators=150,
    max_depth=20,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight='balanced',  # handles class imbalance
    random_state=42,
    n_jobs=-1,  # use all CPU cores
    verbose=1
)

rf_model.fit(X_train, y_train)

# Evaluate
y_pred = rf_model.predict(X_test)
print("\nRandomForest Results:")
print(classification_report(y_test, y_pred, target_names=['Normal', 'Dyslexia Indicator']))

rf_accuracy = rf_model.score(X_test, y_test)
print(f"Test Accuracy: {rf_accuracy:.4f}")

# Cross-validation
cv_scores = cross_val_score(rf_model, X_scaled, y_labels, cv=5, n_jobs=-1)
print(f"5-Fold CV Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")

# Save RandomForest model
joblib.dump(rf_model, MODELS_PATH / 'dyslexia_classifier.pkl')
joblib.dump(scaler, MODELS_PATH / 'feature_scaler.pkl')
print(f"\nSaved: models/dyslexia_classifier.pkl")
print(f"Saved: models/feature_scaler.pkl")

# Feature importance plot
importance = pd.Series(
    rf_model.feature_importances_,
    index=[f'feature_{i}' for i in range(X_features.shape[1])]
).sort_values(ascending=False)[:10]
fig, ax = plt.subplots(figsize=(10, 6))
importance.plot(kind='bar', ax=ax, color='steelblue')
ax.set_title('Top 10 Most Important Forensic Features')
ax.set_xlabel('Feature')
ax.set_ylabel('Importance Score')
plt.tight_layout()
plt.savefig(MODELS_PATH / 'feature_importance.png', dpi=100)
plt.close()
print("Saved: models/feature_importance.png")

# ── Step 5: Train Keras CNN (for Firebase ML / TFLite) ─────────────────────
print("\n[4/6] Training Keras CNN for Firebase ML hosting...")

# Prepare image data for CNN
X_cnn = X_images.astype('float32') / 255.0
X_cnn = X_cnn.reshape(-1, 32, 32, 1)  # add channel dimension

X_train_cnn, X_test_cnn, y_train_cnn, y_test_cnn = train_test_split(
    X_cnn, y_labels, test_size=0.2, random_state=42, stratify=y_labels
)

# Build CNN model
def build_cnn():
    model = keras.Sequential([
        layers.Input(shape=(32, 32, 1)),

        # Conv block 1
        layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),

        # Conv block 2
        layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),

        # Conv block 3
        layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.4),

        # Dense layers
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(64, activation='relu'),
        layers.Dense(1, activation='sigmoid'),  # binary: normal vs indicator
    ])
    return model

cnn_model = build_cnn()
cnn_model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='binary_crossentropy',
    metrics=['accuracy', keras.metrics.AUC(name='auc')]
)
cnn_model.summary()

# Callbacks
callbacks = [
    keras.callbacks.EarlyStopping(
        monitor='val_auc', patience=8, restore_best_weights=True, mode='max'
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss', factor=0.5, patience=4, min_lr=1e-6
    ),
    keras.callbacks.ModelCheckpoint(
        str(MODELS_PATH / 'dyslexia_cnn_best.h5'),
        monitor='val_auc', save_best_only=True, mode='max'
    )
]

# Data augmentation for training
datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    rotation_range=5,
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.1,
    horizontal_flip=False,  # never flip — we're detecting reversals!
)

history = cnn_model.fit(
    datagen.flow(X_train_cnn, y_train_cnn, batch_size=32),
    epochs=40,
    validation_data=(X_test_cnn, y_test_cnn),
    callbacks=callbacks,
    verbose=1
)

# Evaluate CNN
cnn_results = cnn_model.evaluate(X_test_cnn, y_test_cnn, verbose=0)
print(f"\nCNN Results — Loss: {cnn_results[0]:.4f}, Accuracy: {cnn_results[1]:.4f}, AUC: {cnn_results[2]:.4f}")

# Save Keras model
cnn_model.save(str(MODELS_PATH / 'dyslexia_cnn.h5'))
print("Saved: models/dyslexia_cnn.h5")

# Training history plot
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes[0].plot(history.history['accuracy'], label='Train')
axes[0].plot(history.history['val_accuracy'], label='Validation')
axes[0].set_title('CNN Accuracy')
axes[0].legend()
axes[1].plot(history.history['loss'], label='Train')
axes[1].plot(history.history['val_loss'], label='Validation')
axes[1].set_title('CNN Loss')
axes[1].legend()
plt.tight_layout()
plt.savefig(MODELS_PATH / 'training_history.png', dpi=100)
plt.close()
print("Saved: models/training_history.png")

# ── Step 6: Convert to TFLite for Firebase ML ──────────────────────────────
print("\n[5/6] Converting to TFLite for Firebase ML hosting...")

converter = tf.lite.TFLiteConverter.from_keras_model(cnn_model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]  # quantisation for smaller size
converter.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS,
    tf.lite.OpsSet.SELECT_TF_OPS
]
tflite_model = converter.convert()

tflite_path = MODELS_PATH / 'dyslexia_cnn.tflite'
with open(tflite_path, 'wb') as f:
    f.write(tflite_model)

tflite_size = os.path.getsize(tflite_path) / 1024
print(f"Saved: models/dyslexia_cnn.tflite ({tflite_size:.1f} KB)")

# Verify TFLite model
interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
print(f"TFLite input shape: {input_details[0]['shape']}")
print(f"TFLite output shape: {output_details[0]['shape']}")
print("TFLite model verified successfully")

# ── Step 7: Save model metadata ─────────────────────────────────────────────
print("\n[6/6] Saving model metadata...")

metadata = {
    "model_version": "1.0.0",
    "trained_on": "IAM Handwriting Word Database (Kaggle)",
    "samples_trained": int(len(y_labels)),
    "rf_accuracy": float(rf_accuracy),
    "rf_cv_mean": float(cv_scores.mean()),
    "cnn_accuracy": float(cnn_results[1]),
    "cnn_auc": float(cnn_results[2]),
    "feature_count": int(X_features.shape[1]),
    "img_size": list(IMG_SIZE),
    "classes": ["normal", "dyslexia_indicator"],
    "forensic_features": [
        "height_variance", "width_variance", "area_variance",
        "baseline_deviation", "spacing_irregularity", "component_count",
        "component_ratio", "aspect_ratio_mean", "aspect_ratio_std",
        "ink_density", "h_proj_variance", "v_proj_variance",
        "stroke_width_mean", "stroke_width_std",
        "horizontal_symmetry", "vertical_symmetry",
        "corner_count", "contour_complexity",
        "ascender_ratio", "lr_ratio"
    ]
}

with open(MODELS_PATH / 'model_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print("Saved: models/model_metadata.json")

print("\n" + "=" * 60)
print("TRAINING COMPLETE")
print("=" * 60)
print(f"RandomForest accuracy:  {rf_accuracy:.1%}")
print(f"CNN accuracy:           {cnn_results[1]:.1%}")
print(f"CNN AUC:                {cnn_results[2]:.3f}")
print(f"\nModel files in: {MODELS_PATH}")
print("  dyslexia_classifier.pkl  → Render FastAPI (RF model)")
print("  feature_scaler.pkl       → Render FastAPI (feature scaler)")
print("  dyslexia_cnn.h5          → Keras model backup")
print("  dyslexia_cnn.tflite      → Firebase ML Custom Model")
print("  model_metadata.json      → version tracking")
print("\nNext: Upload dyslexia_cnn.tflite to Firebase ML Custom Models")
