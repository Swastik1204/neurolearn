import * as tf from '@tensorflow/tfjs';

// Firebase ML hosted TFLite model URL
// Replace YOUR_MODEL_ID with the actual Firebase ML model ID after running upload_model_to_firebase.py
const FIREBASE_ML_MODEL_URL =
  'https://firebaseml.googleapis.com/v1beta2/projects/neurolearn-tutor-app/models/YOUR_MODEL_ID:download?alt=media';

let model = null;
let modelLoading = false;

export async function loadDyslexiaModel() {
  if (model) return model;
  if (modelLoading) {
    // Wait for existing load to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    return model;
  }
  modelLoading = true;
  try {
    // Use TF.js LayersModel as fallback since tfjs-tflite has Vite 8 compat issues
    // The model URL should point to a converted TF.js model or use the TFLite WASM runtime
    model = await tf.loadLayersModel(FIREBASE_ML_MODEL_URL);
    console.log('NeuroLearn ML model loaded from Firebase ML');
    return model;
  } catch (err) {
    console.error('Failed to load ML model:', err);
    modelLoading = false;
    return null;
  }
}

export async function analyzeHandwritingLocally(canvasElement) {
  const loadedModel = await loadDyslexiaModel();
  if (!loadedModel) return null;

  try {
    // Preprocess canvas to 32x32 grayscale tensor
    const tensor = tf.tidy(() => {
      const imgTensor = tf.browser.fromPixels(canvasElement, 1); // grayscale
      const resized = tf.image.resizeBilinear(imgTensor, [32, 32]);
      const normalized = resized.div(255.0);
      return normalized.expandDims(0); // shape: [1, 32, 32, 1]
    });

    const prediction = loadedModel.predict(tensor);
    const riskScore = prediction.dataSync()[0];
    tensor.dispose();

    return {
      riskScore: parseFloat(riskScore.toFixed(3)),
      riskLevel: riskScore > 0.65 ? 'high' : riskScore > 0.35 ? 'medium' : 'low',
      source: 'firebase_ml_local'
    };
  } catch (err) {
    console.error('Local ML analysis failed:', err);
    return null;
  }
}
