import { useMemo } from "react";
import { useAppContext } from "../context/AppContext.jsx";

function CircularChart({ value, label, colorClass }) {
  const percentage = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className={`circular-chart ${colorClass}`} viewBox="0 0 36 36">
          <path
            className="circle-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="circle"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            stroke="currentColor"
            strokeDasharray={`${percentage}, 100`}
          />
          <text className="percentage text-xs" x="18" y="20.35">
            {percentage}%
          </text>
        </svg>
      </div>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
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

  const joyValue = emotionState.mood === "joyful" ? 0.9 : 0.5;

  return (
    <div className="glass-panel rounded-3xl p-8 sticky top-28 border border-white/60">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-full bg-yellow-300 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(253,224,71,0.6)] animate-pulse">
          {emoji}
        </div>
        <div>
          <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
            Emotional Pulse
          </span>
          <h2 className="text-xl font-bold text-slate-800">How we feeling?</h2>
        </div>
      </div>

      {/* ── Circular Charts ── */}
      <div className="grid grid-cols-3 gap-2 mb-8">
        <CircularChart
          value={emotionState.confidence}
          label="Confidence"
          colorClass="text-[#6366f1]"
        />
        <CircularChart
          value={emotionState.energy}
          label="Energy"
          colorClass="text-[#f472b6]"
        />
        <CircularChart
          value={joyValue}
          label="Joy"
          colorClass="text-cyan-400"
        />
      </div>

      {/* ── Info Cards ── */}
      <div className="space-y-4 bg-white/40 p-5 rounded-2xl backdrop-blur-md border border-white/40">
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-rounded text-indigo-500 text-sm">
              smart_toy
            </span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">AI Inference</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Privacy-first emotion detection running locally via TensorFlow.js.
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-rounded text-pink-500 text-sm">
              favorite
            </span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Auto-Calm</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Breathing exercises trigger automatically if frustration rises.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmotionVisualizer;
