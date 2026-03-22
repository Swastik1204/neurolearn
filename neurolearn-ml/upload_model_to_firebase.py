"""
Upload the trained TFLite model to Firebase ML Custom Models.
Run this once after training to host the model on Firebase.
"""

import firebase_admin
from firebase_admin import credentials, ml
from pathlib import Path
import json

# Initialize Firebase Admin
SERVICE_ACCOUNT_PATH = r"D:\My projects\NeuroLearn\neurolearn-ml\firebase_service_account.json"
TFLITE_PATH = Path(r"D:\My projects\NeuroLearn\neurolearn-ml\models\dyslexia_cnn.tflite")
METADATA_PATH = Path(r"D:\My projects\NeuroLearn\neurolearn-ml\models\model_metadata.json")

print("Initializing Firebase Admin SDK...")
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred, {
    'storageBucket': 'neurolearn-tutor-app.firebasestorage.app'
})

# Load metadata
with open(METADATA_PATH) as f:
    meta = json.load(f)

print(f"Uploading TFLite model ({TFLITE_PATH.stat().st_size / 1024:.1f} KB)...")

# Upload to Firebase ML
model_source = ml.TFLiteGCSModelSource.from_tflite_model_file(str(TFLITE_PATH))

model = ml.Model(
    display_name="neurolearn_dyslexia_classifier",
    tags=["dyslexia", "handwriting", "neurolearn"],
    model_format=ml.TFLiteFormat(model_source=model_source)
)

# Check if model already exists
existing_models = ml.list_models(ml.ListModelsPage)
existing = None
for m in existing_models.iterate_all():
    if m.display_name == "neurolearn_dyslexia_classifier":
        existing = m
        break

if existing:
    print(f"Updating existing model (ID: {existing.model_id})...")
    existing.model_format = ml.TFLiteFormat(model_source=model_source)
    updated_model = ml.update_model(existing)
    ml.publish_model(updated_model.model_id)
    print(f"Model updated and published — ID: {updated_model.model_id}")
    model_id = updated_model.model_id
else:
    print("Creating new model...")
    new_model = ml.create_model(model)
    ml.publish_model(new_model.model_id)
    print(f"Model created and published — ID: {new_model.model_id}")
    model_id = new_model.model_id

print(f"\nFirebase ML Model ID: {model_id}")
print("Save this ID — you need it in the frontend to download the model")
print(f"\nVerify at: https://console.firebase.google.com/project/neurolearn-tutor-app/ml/custom")
