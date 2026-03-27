import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_URI = '/models';
const EMOTION_SAMPLE_MS = 800;

let modelLoadPromise = null;

function loadFaceApiModels() {
  if (!modelLoadPromise) {
    modelLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URI),
    ]);
  }
  return modelLoadPromise;
}

function pickDominantEmotion(expressions = {}) {
  let dominant = 'neutral';
  let confidence = 0;

  Object.entries(expressions).forEach(([emotion, score]) => {
    if (typeof score === 'number' && score > confidence) {
      dominant = emotion;
      confidence = score;
    }
  });

  return { dominantEmotion: dominant, confidence };
}

export default function useEmotionDetection(enabled = true) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [dominantEmotion, setDominantEmotion] = useState(null);
  const [emotionConfidence, setEmotionConfidence] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const start = async () => {
      if (!enabled) {
        cleanup();
        return;
      }

      try {
        setModelsLoading(true);
        setModelReady(false);
        setCameraReady(false);
        await loadFaceApiModels();
        if (cancelled) return;
        setModelReady(true);
        setModelsLoading(false);

        if (!navigator.mediaDevices?.getUserMedia) {
          console.warn('Camera API is not supported in this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (_) {
            // autoplay may be blocked; element is still ready after user interaction
          }
        }
        setCameraReady(true);

        intervalRef.current = setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || document.hidden) return;

          try {
            const detection = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
              .withFaceExpressions();

            if (!detection?.expressions) return;
            const next = pickDominantEmotion(detection.expressions);
            setDominantEmotion(next.dominantEmotion);
            setEmotionConfidence(next.confidence);
          } catch (_) {
            // Ignore transient frame-level detection errors.
          }
        }, EMOTION_SAMPLE_MS);
      } catch (err) {
        setModelsLoading(false);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          console.info('Camera access denied by user. Emotion UI will remain hidden.');
          return;
        }
        console.warn('Emotion detection unavailable:', err?.message || err);
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled]);

  return {
    videoRef,
    dominantEmotion,
    emotionConfidence,
    modelReady,
    cameraReady,
    modelsLoading,
  };
}
