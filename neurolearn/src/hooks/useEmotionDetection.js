import { useRef } from 'react';

export default function useEmotionDetection() {
  const videoRef = useRef(null);

  return {
    videoRef,
    dominantEmotion: null,
    modelReady: false,
    cameraReady: false,
    modelsLoading: false,
  };
}
