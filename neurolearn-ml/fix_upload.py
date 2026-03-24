import firebase_admin
from firebase_admin import credentials, ml
from pathlib import Path

sa = Path('firebase_service_account.json')
cred = credentials.Certificate(str(sa))
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {'storageBucket': 'neurolearn-tutor-app.firebasestorage.app'})

model_source = ml.TFLiteGCSModelSource.from_tflite_model_file('models/dyslexia_cnn.tflite')
new_model = ml.Model(display_name='neurolearn_dyslexia_classifier', tags=['dyslexia','v1'], model_format=ml.TFLiteFormat(model_source=model_source))
created = ml.create_model(new_model)
ml.publish_model(created.model_id)

with open('models/firebase_ml_model_id.txt', 'w') as f:
    f.write(created.model_id)
print('Model ID:', created.model_id)
