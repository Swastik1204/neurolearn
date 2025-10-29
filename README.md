# NeuroLearn – Generative AI Tutor

NeuroLearn is a progressive web application scaffolded with **Vite + React** and Firebase. It helps neurodivergent children practice early literacy through adaptive, AI-generated lessons that respond to handwriting quality and emotional feedback.

## ✨ Highlights

- TailwindCSS + DaisyUI design system for accessible, high-contrast UI.
- Canvas handwriting pad with stroke capture for TensorFlow.js analysis.
- Emotion visualiser and adaptive reinforcement utilities driven by AI heuristics.
- Firebase modules for Auth, Firestore, Storage, Functions, and ML hosting.
- Generative AI hooks ready for Gemini/OpenAI/HuggingFace or Replicate.
- Installable PWA (manifest + offline service worker) ready for Firebase Hosting.

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to explore the scaffold. The service worker registers automatically in production builds.

## 🔐 Environment Variables

Duplicate `.env.example` (create it if needed) and provide the following values before connecting Firebase/LLMs:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_GENAI_API_KEY=
VITE_GENAI_PROVIDER=openai | gemini | huggingface
```

Add Replicate tokens or custom endpoints to `src/utils/genAI.js` if you plan to generate alphabet visuals.

## 🧱 Project Structure

```
public/
	manifest.json       # PWA metadata
	service-worker.js   # Offline cache + install prompt
src/
	components/         # Navbar, CanvasPad, EmotionVisualizer, etc.
	context/AppContext  # Global session + emotion state
	firebase/           # Config, auth, db, ML helpers
	pages/              # Home, Learn, Draw, Profile routes
	utils/              # genAI, emotion analysis, adaptive reinforcement
	main.jsx            # Router, providers, PWA registration
	main.css            # Tailwind base + accessibility tweaks
```

## 🧠 AI Pipelines

- **Generative lessons**: `src/utils/genAI.js` builds prompts using user, performance, and emotion context. Replace the `fetch` block to call your preferred LLM provider.
- **Emotion analysis**: `src/utils/emotionAnalysis.js` normalises canvas strokes and feeds them into a TensorFlow.js CNN hosted in Firebase ML.
- **Adaptive reinforcement**: `src/utils/reinforcement.js` fuses emotion outputs with performance to suggest the next activity and log data to Firestore.

Inline comments mark locations where you can integrate real models, webcam-based MediaPipe pipelines, or Replicate image generation.

## 📦 Scripts

- `npm run dev` – Start Vite dev server.
- `npm run build` – Create production build (generates service worker precache).
- `npm run preview` – Preview production build locally.
- `npm run lint` – Run ESLint with project defaults.

## ☁️ Deployment

1. Configure Firebase Hosting (`firebase init hosting`).
2. Add environment variables to Firebase (`firebase functions:config:set`).
3. Deploy: `npm run build` then `firebase deploy`.

Optional: Add CI/CD or Firebase Extensions for automated lesson summaries and weekly parent reports.

## 🗺️ Next Steps

- Connect real TensorFlow.js handwriting + emotion models (see `src/firebase/ml.js`).
- Hook LLM responses to Firestore to persist generated lessons per child.
- Enable voice narration with Web Speech API inside `LessonGenerator` prompts.
- Expand accessibility with larger toggles, icon labels, and keyboard navigation tests.

Enjoy building a caring learning companion! 🌈
