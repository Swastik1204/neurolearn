import { useMemo } from "react";
import { FiActivity, FiHeart, FiSmile } from "react-icons/fi";
import { useAppContext } from "../context/AppContext.jsx";

function EmotionBar({ label, value, color }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-600">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-200">
        <div
          className="h-3 rounded-full transition-all"
          style={{ width: `${Math.round(value * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function EmotionVisualizer() {
  const {
    state: { emotionState },
  } = useAppContext();

  const emoji = useMemo(() => {
    if (emotionState.mood === "joyful") return "😊";
    if (emotionState.mood === "frustrated") return "😣";
    if (emotionState.mood === "focused") return "🤓";
    return "🙂";
  }, [emotionState.mood]);

  return (
    <section className="card-glow rounded-3xl bg-gradient-to-br from-indigo-100 via-white to-pink-100 p-6 shadow-lg">
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-3xl">
          {emoji}
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">
            Emotional pulse
          </p>
          <h3 className="text-xl font-bold text-slate-800">
            How are we feeling?
          </h3>
        </div>
      </header>

      <p className="mt-4 text-sm text-slate-600">
        The AI monitors colour choices, stroke pressure, and optional webcam
        cues to guess the current mood. This helps adapt lessons before
        frustration builds up.
      </p>

      <div className="mt-4 grid gap-4">
        <EmotionBar
          label="Confidence"
          value={emotionState.confidence}
          color="#6366f1"
        />
        <EmotionBar
          label="Energy"
          value={emotionState.energy}
          color="#f472b6"
        />
        <EmotionBar
          label="Joy"
          value={emotionState.mood === "joyful" ? 1 : 0.5}
          color="#22d3ee"
        />
      </div>

      <div className="mt-6 grid gap-3 text-sm text-slate-600">
        <p className="flex items-center gap-2">
          <FiSmile className="text-primary" />
          Emotion inference runs locally with TensorFlow.js. The averaged score
          is persisted to Firestore for parental review.
        </p>
        <p className="flex items-center gap-2">
          <FiHeart className="text-secondary" />
          Calm breathing or break prompts trigger when frustration exceeds the
          configured threshold.
        </p>
        <p className="flex items-center gap-2">
          <FiActivity className="text-accent" />
          You can plug in webcam-based cues later by updating `firebase/ml.js`.
        </p>
      </div>
    </section>
  );
}

export default EmotionVisualizer;
