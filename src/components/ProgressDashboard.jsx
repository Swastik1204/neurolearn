import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FaChartLine, FaHeart } from "react-icons/fa";
import { useAppContext } from "../context/AppContext.jsx";

const MOCK_HISTORY = [
  { session: "Mon", accuracy: 0.52, emotion: 0.62 },
  { session: "Tue", accuracy: 0.58, emotion: 0.7 },
  { session: "Wed", accuracy: 0.65, emotion: 0.74 },
  { session: "Thu", accuracy: 0.68, emotion: 0.71 },
  { session: "Fri", accuracy: 0.72, emotion: 0.78 },
];

function ProgressDashboard() {
  const {
    state: { performance, emotionState, lessonQueue },
  } = useAppContext();

  const averages = useMemo(() => {
    const totalAccuracy = MOCK_HISTORY.reduce(
      (sum, item) => sum + item.accuracy,
      0
    );
    const totalEmotion = MOCK_HISTORY.reduce(
      (sum, item) => sum + item.emotion,
      0
    );
    return {
      avgAccuracy: totalAccuracy / MOCK_HISTORY.length,
      avgEmotion: totalEmotion / MOCK_HISTORY.length,
    };
  }, []);

  return (
    <section className="rounded-3xl bg-base-100 p-6 shadow-lg">
      <header className="flex items-center gap-3">
        <span className="btn btn-circle btn-secondary btn-sm">
          <FaChartLine size={16} />
        </span>
        <div>
          <h3 className="text-lg font-bold text-slate-700">
            Progress snapshot
          </h3>
          <p className="text-sm text-slate-500">
            Parents can review weekly trends and emotional wellbeing.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-secondary/10 p-4">
          <p className="text-xs uppercase tracking-wide text-secondary">
            Current streak
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-700">
            {performance.streak} days
          </p>
          <p className="text-sm text-slate-500">
            Keeps motivation high with gentle reminders.
          </p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-4">
          <p className="text-xs uppercase tracking-wide text-primary">
            Average accuracy
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-700">
            {Math.round(averages.avgAccuracy * 100)}%
          </p>
          <p className="text-sm text-slate-500">
            Based on handwriting model scores saved in Firestore.
          </p>
        </div>
        <div className="rounded-2xl bg-accent/10 p-4">
          <p className="text-xs uppercase tracking-wide text-accent">
            Joy index
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-700">
            {Math.round(emotionState.confidence * 100)}%
          </p>
          <p className="text-sm text-slate-500">
            Higher means more upbeat sessions.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-indigo-100 bg-white p-4">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={MOCK_HISTORY}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEmotion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f472b6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="session" stroke="#94a3b8" />
              <YAxis
                tickFormatter={(value) => `${Math.round(value * 100)}%`}
                stroke="#94a3b8"
              />
              <Tooltip formatter={(value) => `${Math.round(value * 100)}%`} />
              <Area
                type="monotone"
                dataKey="accuracy"
                stroke="#4338ca"
                fill="url(#colorAccuracy)"
              />
              <Area
                type="monotone"
                dataKey="emotion"
                stroke="#ec4899"
                fill="url(#colorEmotion)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-sm text-slate-600">
          <div className="flex items-center gap-2 text-rose-600">
            <FaHeart />
            Emotional insights
          </div>
          <p className="mt-3 leading-relaxed">
            Adaptive reinforcement suggests calming breaks after two
            low-confidence strokes. Webcam cues are optional and handled in the
            ML module. Recent upcoming lessons:
          </p>
          <ul className="mt-3 space-y-2">
            {lessonQueue.slice(0, 3).map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-white/70 p-2 text-slate-700"
              >
                <p className="font-semibold">{item.focus}</p>
                <p className="text-xs text-slate-500">Mode: {item.mode}</p>
              </li>
            ))}
            {lessonQueue.length === 0 && (
              <li className="text-xs text-slate-400">
                Generate a lesson to preview the plan.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default ProgressDashboard;
