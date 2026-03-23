"""
NeuroLearn — Handwriting Analysis Model Training
Dataset: Local ZIP extracted to data/
Output:  models/dyslexia_classifier.pkl  (RandomForest — for Render)
         models/feature_scaler.pkl        (StandardScaler)
         models/dyslexia_cnn.h5           (Keras CNN — backup)
         models/dyslexia_cnn.tflite       (TFLite — for Firebase ML)
         models/model_metadata.json       (version + accuracy info)
         training_log.txt                 (full log — give this to developer)
"""

import os
import sys
import cv2
import time
import json
import joblib
import logging
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
from datetime import datetime
from tqdm import tqdm
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (classification_report, confusion_matrix,
                              roc_auc_score, accuracy_score)
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import warnings
warnings.filterwarnings('ignore')

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE    = Path(r"D:\My projects\NeuroLearn\neurolearn-ml")
DATA    = BASE / "data"
MODELS  = BASE / "models"
LOG_FILE = BASE / "training_log.txt"
MODELS.mkdir(exist_ok=True)

# ── Logging — writes to both console AND training_log.txt ─────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.FileHandler(LOG_FILE, mode='w', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)

def separator():
    log.info("=" * 65)

separator()
log.info("NeuroLearn — Handwriting Analysis Model Training")
log.info(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log.info(f"Python:  {sys.version}")
log.info(f"TF:      {tf.__version__}")
log.info(f"Data:    {DATA}")
log.info(f"Models:  {MODELS}")
separator()

# ── Config ────────────────────────────────────────────────────────────────────
IMG_SIZE   = (32, 32)
MAX_SAMPLES = 10000   # cap for 16GB RAM — increase to 20000 if no OOM
BATCH_SIZE  = 32
EPOCHS      = 50
RF_TREES    = 200
RANDOM_SEED = 42

# ── Step 1: Find all images ────────────────────────────────────────────────────
log.info("\n[STEP 1] Scanning dataset...")

def find_images(root, limit=MAX_SAMPLES):
    exts = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff'}
    found = []
    for p in Path(root).rglob('*'):
        if p.suffix.lower() in exts:
            found.append(p)
            if len(found) >= limit:
                break
    return found

all_images = find_images(DATA)
log.info(f"Total images found: {len(all_images)}")

if len(all_images) == 0:
    log.error(f"No images found in {DATA}")
    log.error("Check that the ZIP was extracted correctly.")
    log.error(f"Contents: {list(DATA.iterdir()) if DATA.exists() else 'directory missing'}")
    sys.exit(1)

# Log sample paths to help verify structure
log.info("Sample image paths (first 5):")
for p in all_images[:5]:
    log.info(f"  {p}")

# ── Step 2: Preprocessing ─────────────────────────────────────────────────────
log.info("\n[STEP 2] Preprocessing images...")

def preprocess(img_path):
    """Forensic preprocessing: grayscale → Otsu binarise → deskew → denoise → resize."""
    img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
    if img is None or img.size == 0:
        return None

    # Otsu binarisation
    _, binary = cv2.threshold(img, 0, 255,
                               cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Skip mostly empty images
    if np.sum(binary > 0) < 50:
        return None

    # Deskew via moments
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) > 10:
        angle = cv2.minAreaRect(coords)[-1]
        angle = -(90 + angle) if angle < -45 else -angle
        if abs(angle) > 0.5:
            (h, w) = binary.shape
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            binary = cv2.warpAffine(binary, M, (w, h),
                                    flags=cv2.INTER_CUBIC,
                                    borderMode=cv2.BORDER_REPLICATE)

    # Morphological denoising
    kernel = np.ones((2, 2), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # Resize to standard size
    return cv2.resize(binary, IMG_SIZE)


# ── Step 3: Feature extraction ────────────────────────────────────────────────
FEATURE_NAMES = [
    'height_variance',    'width_variance',       'area_variance',
    'baseline_deviation', 'spacing_irregularity', 'component_count',
    'component_ratio',    'aspect_ratio_mean',    'aspect_ratio_std',
    'ink_density',        'h_proj_variance',      'v_proj_variance',
    'stroke_width_mean',  'stroke_width_std',     'horizontal_symmetry',
    'vertical_symmetry',  'corner_count',         'contour_complexity',
    'ascender_ratio',     'lr_ratio',
]

def extract_features(img):
    """20-dimensional forensic feature vector from preprocessed image."""
    if img is None:
        return None

    f = {}
    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(img)

    valid = [(i, stats[i]) for i in range(1, num_labels)
             if 30 < stats[i][cv2.CC_STAT_AREA] < 3000]

    if len(valid) < 1:
        return None

    areas   = [s[cv2.CC_STAT_AREA]   for _, s in valid]
    heights = [s[cv2.CC_STAT_HEIGHT] for _, s in valid]
    widths  = [s[cv2.CC_STAT_WIDTH]  for _, s in valid]
    x_pos   = [s[cv2.CC_STAT_LEFT]   for _, s in valid]

    # Variance features
    f['height_variance']    = float(np.std(heights) / (np.mean(heights) + 1e-6))
    f['width_variance']     = float(np.std(widths)  / (np.mean(widths)  + 1e-6))
    f['area_variance']      = float(np.std(areas)   / (np.mean(areas)   + 1e-6))

    # Baseline deviation
    bottoms = [s[cv2.CC_STAT_TOP] + s[cv2.CC_STAT_HEIGHT] for _, s in valid]
    f['baseline_deviation'] = float(np.std(bottoms) / (IMG_SIZE[1] + 1e-6))

    # Spacing
    if len(x_pos) > 1:
        gaps = np.diff(sorted(x_pos))
        f['spacing_irregularity'] = float(np.std(gaps) / (np.mean(gaps) + 1e-6))
    else:
        f['spacing_irregularity'] = 0.0

    # Component counts
    f['component_count'] = float(min(len(valid), 20))
    f['component_ratio']  = float(len(valid) / max(1, len(valid)))

    # Aspect ratio
    aspects = [w / (h + 1e-6) for w, h in zip(widths, heights)]
    f['aspect_ratio_mean'] = float(np.mean(aspects))
    f['aspect_ratio_std']  = float(np.std(aspects))

    # Ink density
    f['ink_density'] = float(np.sum(img > 0) / (img.shape[0] * img.shape[1]))

    # Projection profiles
    f['h_proj_variance'] = float(np.var(np.sum(img, axis=1) / 255.0))
    f['v_proj_variance'] = float(np.var(np.sum(img, axis=0) / 255.0))

    # Stroke width via distance transform
    dt = cv2.distanceTransform(img, cv2.DIST_L2, 5)
    nz = dt[dt > 0]
    f['stroke_width_mean'] = float(np.mean(nz)) if len(nz) > 0 else 0.0
    f['stroke_width_std']  = float(np.std(nz))  if len(nz) > 0 else 0.0

    # Symmetry (key reversal indicator)
    flip_h = cv2.flip(img, 1)
    flip_v = cv2.flip(img, 0)
    diff_h = cv2.absdiff(img, flip_h)
    diff_v = cv2.absdiff(img, flip_v)
    total  = float(img.shape[0] * img.shape[1])
    f['horizontal_symmetry'] = 1.0 - float(np.sum(diff_h > 0)) / total
    f['vertical_symmetry']   = 1.0 - float(np.sum(diff_v > 0)) / total

    # Corner count
    corners = cv2.goodFeaturesToTrack(img, 50, 0.01, 5)
    f['corner_count'] = float(len(corners)) if corners is not None else 0.0

    # Contour complexity
    contours, _ = cv2.findContours(img, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        lc = max(contours, key=cv2.contourArea)
        perim = cv2.arcLength(lc, True)
        area  = cv2.contourArea(lc)
        f['contour_complexity'] = float((perim ** 2) / (4 * np.pi * area + 1e-6))
    else:
        f['contour_complexity'] = 0.0

    # Ascender / left-right ratio
    mid_h = img.shape[0] // 2
    mid_w = img.shape[1] // 2
    top_ink  = float(np.sum(img[:mid_h] > 0))
    bot_ink  = float(np.sum(img[mid_h:] > 0))
    left_ink = float(np.sum(img[:, :mid_w] > 0))
    rgt_ink  = float(np.sum(img[:, mid_w:] > 0))
    f['ascender_ratio'] = top_ink  / (bot_ink + 1e-6)
    f['lr_ratio']       = left_ink / (rgt_ink + 1e-6)

    return [f[k] for k in FEATURE_NAMES]


# ── Step 4: Build dataset ──────────────────────────────────────────────────────
log.info("\n[STEP 3] Extracting features from all images...")

X_feat   = []   # feature vectors
X_img    = []   # raw images for CNN
y        = []   # labels
skipped  = 0
t_start  = time.time()

for img_path in tqdm(all_images, desc="Extracting features", ncols=70):
    proc = preprocess(img_path)
    if proc is None:
        skipped += 1
        continue

    feat = extract_features(proc)
    if feat is None:
        skipped += 1
        continue

    # ── Synthetic label from forensic features ────────────────────────────
    # Since IAM has no dyslexia labels, we derive labels from the features
    # that most strongly correlate with dyslexia indicators in literature:
    #   high horizontal_symmetry → potential reversal
    #   high baseline_deviation  → writing instability
    #   high height_variance     → inconsistent sizing
    #   high lr_ratio asymmetry  → directional confusion
    sym        = feat[FEATURE_NAMES.index('horizontal_symmetry')]
    base_dev   = feat[FEATURE_NAMES.index('baseline_deviation')]
    height_var = feat[FEATURE_NAMES.index('height_variance')]
    lr         = feat[FEATURE_NAMES.index('lr_ratio')]
    lr_asym    = abs(lr - 1.0)

    # Weighted indicator score
    indicator_score = (
        sym        * 0.35 +
        base_dev   * 0.25 +
        height_var * 0.20 +
        lr_asym    * 0.20
    )
    label = 1 if indicator_score > 0.40 else 0

    X_feat.append(feat)
    X_img.append(proc)
    y.append(label)

elapsed = time.time() - t_start
X_feat = np.array(X_feat, dtype=np.float32)
# Clean up any potential inf/nan values from feature extraction calculations
X_feat = np.nan_to_num(X_feat, nan=0.0, posinf=1e6, neginf=-1e6)
X_img  = np.array(X_img,  dtype=np.float32)
y      = np.array(y)

log.info(f"Feature extraction complete in {elapsed:.1f}s")
log.info(f"Total processed : {len(y)}")
log.info(f"Skipped         : {skipped}")
log.info(f"Normal (0)      : {int(np.sum(y == 0))}  ({100*np.mean(y==0):.1f}%)")
log.info(f"Indicator (1)   : {int(np.sum(y == 1))}  ({100*np.mean(y==1):.1f}%)")
log.info(f"Feature shape   : {X_feat.shape}")

if len(y) < 100:
    log.error("Too few samples. Check dataset extraction.")
    sys.exit(1)


# ── Step 5: Train RandomForest ─────────────────────────────────────────────────
separator()
log.info("[STEP 4] Training RandomForest classifier...")

scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X_feat)

X_tr, X_te, y_tr, y_te = train_test_split(
    X_scaled, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
)

log.info(f"Train samples: {len(y_tr)}  |  Test samples: {len(y_te)}")

rf = RandomForestClassifier(
    n_estimators=RF_TREES,
    max_depth=20,
    min_samples_split=4,
    min_samples_leaf=2,
    class_weight='balanced',
    random_state=RANDOM_SEED,
    n_jobs=-1,
    verbose=0
)

t0 = time.time()
rf.fit(X_tr, y_tr)
rf_time = time.time() - t0

y_pred    = rf.predict(X_te)
y_proba   = rf.predict_proba(X_te)[:, 1]
rf_acc    = accuracy_score(y_te, y_pred)
rf_auc    = roc_auc_score(y_te, y_proba)

log.info(f"\nRandomForest training time : {rf_time:.1f}s")
log.info(f"Test accuracy              : {rf_acc:.4f}  ({rf_acc*100:.2f}%)")
log.info(f"Test AUC                   : {rf_auc:.4f}")
log.info("\nClassification Report:")
report = classification_report(y_te, y_pred,
                                target_names=['Normal', 'Dyslexia Indicator'])
for line in report.split('\n'):
    log.info(line)

log.info("Confusion Matrix:")
cm = confusion_matrix(y_te, y_pred)
log.info(f"  TN={cm[0,0]}  FP={cm[0,1]}")
log.info(f"  FN={cm[1,0]}  TP={cm[1,1]}")

# 5-fold cross validation
log.info("\n5-fold cross validation (takes a few minutes)...")
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
cv_scores = cross_val_score(rf, X_scaled, y, cv=cv, scoring='roc_auc', n_jobs=-1)
log.info(f"CV AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")
log.info(f"CV per fold: {[f'{s:.4f}' for s in cv_scores]}")

# Save RF model
joblib.dump(rf,     MODELS / 'dyslexia_classifier.pkl')
joblib.dump(scaler, MODELS / 'feature_scaler.pkl')
log.info(f"\nSaved: {MODELS/'dyslexia_classifier.pkl'}")
log.info(f"Saved: {MODELS/'feature_scaler.pkl'}")

# Feature importance plot
importance_df = pd.DataFrame({
    'feature': FEATURE_NAMES,
    'importance': rf.feature_importances_
}).sort_values('importance', ascending=False)

fig, ax = plt.subplots(figsize=(10, 6))
importance_df.head(10).plot(x='feature', y='importance', kind='bar', ax=ax,
                             color='steelblue', legend=False)
ax.set_title('Top 10 Most Important Forensic Features (RandomForest)')
ax.set_xlabel('')
ax.set_ylabel('Importance')
plt.xticks(rotation=30, ha='right')
plt.tight_layout()
plt.savefig(MODELS / 'feature_importance.png', dpi=100)
plt.close()
log.info("Saved: models/feature_importance.png")

log.info("\nTop 10 feature importances:")
for _, row in importance_df.head(10).iterrows():
    log.info(f"  {row['feature']:30s} {row['importance']:.4f}")


# ── Step 6: Train Keras CNN ────────────────────────────────────────────────────
separator()
log.info("[STEP 5] Training Keras CNN (for Firebase ML / TFLite)...")

# Prepare CNN data — normalize, add channel dim
X_cnn = (X_img / 255.0).reshape(-1, 32, 32, 1)

X_tr_c, X_te_c, y_tr_c, y_te_c = train_test_split(
    X_cnn, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
)
log.info(f"CNN train: {len(y_tr_c)}  |  test: {len(y_te_c)}")

def build_cnn(input_shape=(32, 32, 1)):
    m = keras.Sequential([
        layers.Input(shape=input_shape),
        layers.Conv2D(32, (3,3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2,2)),
        layers.Dropout(0.25),

        layers.Conv2D(64, (3,3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2,2)),
        layers.Dropout(0.25),

        layers.Conv2D(128, (3,3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.4),

        layers.Dense(128, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(64,  activation='relu'),
        layers.Dense(1,   activation='sigmoid'),
    ])
    return m

cnn = build_cnn()
cnn.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='binary_crossentropy',
    metrics=['accuracy', keras.metrics.AUC(name='auc')]
)

# Log model summary to file
summary_lines = []
cnn.summary(print_fn=lambda x: summary_lines.append(x))
for line in summary_lines:
    log.info(line)

callbacks = [
    keras.callbacks.EarlyStopping(
        monitor='val_auc', patience=8,
        restore_best_weights=True, mode='max', verbose=1
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss', factor=0.5, patience=4,
        min_lr=1e-6, verbose=1
    ),
    keras.callbacks.ModelCheckpoint(
        str(MODELS / 'dyslexia_cnn_best.h5'),
        monitor='val_auc', save_best_only=True, mode='max', verbose=1
    ),
]

# Data augmentation — NOTE: horizontal_flip=False is CRITICAL
# Flipping handwriting would teach the model that b and d are the same —
# the exact opposite of what reversal detection requires.
datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    rotation_range=5,
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.1,
    horizontal_flip=False,   # ← NEVER flip handwriting images
    fill_mode='nearest'
)

log.info(f"\nStarting CNN training — max {EPOCHS} epochs, batch {BATCH_SIZE}...")
log.info("(EarlyStopping will stop training early if val_auc plateaus)")

t0 = time.time()
history = cnn.fit(
    datagen.flow(X_tr_c, y_tr_c, batch_size=BATCH_SIZE),
    epochs=EPOCHS,
    validation_data=(X_te_c, y_te_c),
    callbacks=callbacks,
    verbose=1
)
cnn_time = time.time() - t0

# Evaluate
cnn_results = cnn.evaluate(X_te_c, y_te_c, verbose=0)
cnn_loss, cnn_acc, cnn_auc = cnn_results

log.info(f"\nCNN training time : {cnn_time:.1f}s ({cnn_time/60:.1f} min)")
log.info(f"CNN test loss     : {cnn_loss:.4f}")
log.info(f"CNN test accuracy : {cnn_acc:.4f}  ({cnn_acc*100:.2f}%)")
log.info(f"CNN test AUC      : {cnn_auc:.4f}")

actual_epochs = len(history.history['accuracy'])
log.info(f"Epochs trained    : {actual_epochs} / {EPOCHS}")
log.info(f"Best val_auc      : {max(history.history['val_auc']):.4f}")
log.info(f"Best val_acc      : {max(history.history['val_accuracy']):.4f}")

# Save Keras model
cnn.save(str(MODELS / 'dyslexia_cnn.h5'))
log.info(f"Saved: {MODELS/'dyslexia_cnn.h5'}")

# Training history plot
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
axes[0].plot(history.history['accuracy'],     label='Train')
axes[0].plot(history.history['val_accuracy'], label='Validation')
axes[0].set_title('Accuracy')
axes[0].legend()
axes[1].plot(history.history['loss'],     label='Train')
axes[1].plot(history.history['val_loss'], label='Validation')
axes[1].set_title('Loss')
axes[1].legend()
axes[2].plot(history.history['auc'],     label='Train')
axes[2].plot(history.history['val_auc'], label='Validation')
axes[2].set_title('AUC')
axes[2].legend()
plt.tight_layout()
plt.savefig(MODELS / 'training_history.png', dpi=100)
plt.close()
log.info("Saved: models/training_history.png")


# ── Step 7: Convert to TFLite ─────────────────────────────────────────────────
separator()
log.info("[STEP 6] Converting CNN to TFLite for Firebase ML...")

try:
    converter = tf.lite.TFLiteConverter.from_keras_model(cnn)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    # Include SELECT_TF_OPS in case of unsupported ops
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS
    ]
    tflite_model = converter.convert()

    tflite_path = MODELS / 'dyslexia_cnn.tflite'
    tflite_path.write_bytes(tflite_model)
    tflite_kb = tflite_path.stat().st_size / 1024
    log.info(f"Saved: {tflite_path}  ({tflite_kb:.1f} KB)")

    # Verify TFLite
    interp = tf.lite.Interpreter(model_path=str(tflite_path))
    interp.allocate_tensors()
    inp = interp.get_input_details()
    out = interp.get_output_details()
    log.info(f"TFLite input  shape: {inp[0]['shape']}")
    log.info(f"TFLite output shape: {out[0]['shape']}")
    log.info("TFLite verification: PASSED")

except Exception as e:
    log.error(f"TFLite conversion failed: {e}")
    log.error("The .h5 model is still saved — you can convert it later.")


# ── Step 8: Save metadata ─────────────────────────────────────────────────────
separator()
log.info("[STEP 7] Saving model metadata...")

metadata = {
    "model_version":    "1.0.0",
    "trained_on":       "IAM Handwriting Word Database (Kaggle nibinv23)",
    "training_date":    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    "samples_total":    int(len(y)),
    "samples_normal":   int(np.sum(y == 0)),
    "samples_indicator":int(np.sum(y == 1)),
    "rf_accuracy":      float(round(rf_acc,  4)),
    "rf_auc":           float(round(rf_auc,  4)),
    "rf_cv_auc_mean":   float(round(cv_scores.mean(), 4)),
    "rf_cv_auc_std":    float(round(cv_scores.std(),  4)),
    "cnn_accuracy":     float(round(cnn_acc, 4)),
    "cnn_auc":          float(round(cnn_auc, 4)),
    "cnn_epochs":       int(actual_epochs),
    "feature_count":    int(X_feat.shape[1]),
    "feature_names":    FEATURE_NAMES,
    "img_size":         list(IMG_SIZE),
    "classes":          ["normal", "dyslexia_indicator"],
    "machine":          "Ryzen 5, 16GB RAM, CPU-only",
}

(MODELS / 'model_metadata.json').write_text(
    json.dumps(metadata, indent=2), encoding='utf-8'
)
log.info(f"Saved: {MODELS/'model_metadata.json'}")


# ── Final summary ─────────────────────────────────────────────────────────────
separator()
total_time = time.time() - t_start
log.info("TRAINING COMPLETE")
separator()
log.info(f"Total time          : {total_time/60:.1f} minutes")
log.info(f"Samples processed   : {len(y)}")
log.info(f"")
log.info(f"RandomForest:")
log.info(f"  Accuracy          : {rf_acc*100:.2f}%")
log.info(f"  AUC               : {rf_auc:.4f}")
log.info(f"  CV AUC            : {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")
log.info(f"")
log.info(f"CNN (TFLite / Firebase ML):")
log.info(f"  Accuracy          : {cnn_acc*100:.2f}%")
log.info(f"  AUC               : {cnn_auc:.4f}")
log.info(f"  Epochs            : {actual_epochs}")
log.info(f"")
log.info(f"Files saved to {MODELS}:")
for f in sorted(MODELS.iterdir()):
    size_kb = f.stat().st_size / 1024
    log.info(f"  {f.name:40s} {size_kb:8.1f} KB")
log.info(f"")
log.info(f"Log saved to: {LOG_FILE}")
log.info(f"Give training_log.txt to your developer for review.")
separator()
