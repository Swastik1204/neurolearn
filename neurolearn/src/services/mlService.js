// mlService.js — TFLite removed, server-side analysis handles all scoring
const mlService = {
  isLoaded: false,

  async initialize() {
    console.log('[NeuroLearn ML] Using server-side analysis only.');
    this.isLoaded = false;
    return false;
  },

  async analyzeHandwriting(canvas) {
    // Always return null — WritingExercise.jsx handles the server fallback
    return null;
  }
};

export default mlService;
