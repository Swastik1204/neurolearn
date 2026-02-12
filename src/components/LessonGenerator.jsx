import { useEffect, useState } from "react";
import { generateAdaptiveLesson } from "../utils/genAI.js";
import { useAppContext } from "../context/AppContext.jsx";

function LessonGenerator({ autoStart = true }) {
  const {
    state: { user, emotionState, performance },
    setLessonQueue,
  } = useAppContext();

  const [lesson, setLesson] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestLesson = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await generateAdaptiveLesson({
        user,
        emotionState,
        performance,
      });
      setLesson(response.lesson);
      setLessonQueue(response.upcomingLessons);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoStart) {
      requestLesson();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      {/* ── Header Bar: Today's Adventure ── */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 transform rotate-3">
            <span className="material-symbols-rounded text-3xl">rocket_launch</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Today's Adventure</h2>
            <p className="text-slate-500 font-medium">
              Custom-tailored learning prompts powered by AI.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 px-6 py-3 bg-white/50 hover:bg-white/80 border border-white/40 rounded-full text-sm font-bold text-slate-700 transition-all flex items-center gap-2 shadow-sm"
          onClick={requestLesson}
          disabled={isLoading}
        >
          <span
            className={`material-symbols-rounded text-lg ${isLoading ? "animate-spin" : ""}`}
          >
            refresh
          </span>
          {isLoading ? "Thinking…" : "New lesson"}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="glass-panel rounded-2xl p-4 border-red-200/50 bg-red-50/50 text-red-600 text-sm">
          LLM request failed. Check API keys inside <code>utils/genAI.js</code>.
        </div>
      )}

      {/* ── Lesson Content Card ── */}
      <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          <div className="flex-1">
            {lesson ? (
              <>
                {/* Category badge */}
                <span className="inline-block px-4 py-1.5 bg-blue-100/50 text-blue-600 text-xs font-bold uppercase tracking-widest rounded-full mb-4 border border-blue-200/50">
                  Letter Practice
                </span>

                <h3 className="text-3xl font-bold text-slate-800 mb-3">
                  {lesson.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  {lesson.story}
                </p>

                {/* Activity rows */}
                <div className="space-y-4">
                  {lesson.activities.map((activity, index) => {
                    const colors = [
                      {
                        bg: "bg-blue-100",
                        text: "text-blue-600",
                        hoverBg: "group-hover:bg-blue-500",
                        hoverShadow: "hover:shadow-blue-500/10",
                        hoverBorder: "hover:border-blue-300/50",
                        chevron: "group-hover:text-blue-500",
                      },
                      {
                        bg: "bg-pink-100",
                        text: "text-pink-500",
                        hoverBg: "group-hover:bg-pink-500",
                        hoverShadow: "hover:shadow-pink-500/10",
                        hoverBorder: "hover:border-pink-300/50",
                        chevron: "group-hover:text-pink-500",
                      },
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div
                        key={activity.id}
                        className={`glass-button p-4 rounded-2xl flex items-center gap-4 cursor-pointer group hover:scale-[1.01] hover:shadow-lg ${color.hoverShadow} ${color.hoverBorder}`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl ${color.bg} ${color.text} flex items-center justify-center shrink-0 shadow-sm ${color.hoverBg} group-hover:text-white transition-colors duration-300`}
                        >
                          <span className="material-symbols-rounded text-xl">
                            {index % 2 === 0 ? "gesture" : "palette"}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-lg">
                            {activity.prompt}
                          </h4>
                          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                            {activity.mode}
                          </span>
                        </div>
                        <span
                          className={`material-symbols-rounded ml-auto text-slate-400 ${color.chevron} transition-colors`}
                        >
                          arrow_forward_ios
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <span className="inline-block px-4 py-1.5 bg-blue-100/50 text-blue-600 text-xs font-bold uppercase tracking-widest rounded-full mb-4 border border-blue-200/50">
                  Letter Practice
                </span>
                <h3 className="text-3xl font-bold text-slate-800 mb-3">
                  The Curvy Letter C Adventure
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Sunny the Seahorse loves drawing the letter C. Let's help
                  Sunny trace smooth curves under the rainbow reef.
                </p>
                <div className="space-y-4">
                  <div className="glass-button p-4 rounded-2xl flex items-center gap-4 cursor-pointer group hover:scale-[1.01] hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-300/50">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                      <span className="material-symbols-rounded text-xl">gesture</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">Trace the letter C</h4>
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                        Drawing Activity
                      </span>
                    </div>
                    <span className="material-symbols-rounded ml-auto text-slate-400 group-hover:text-blue-500 transition-colors">
                      arrow_forward_ios
                    </span>
                  </div>
                  <div className="glass-button p-4 rounded-2xl flex items-center gap-4 cursor-pointer group hover:scale-[1.01] hover:shadow-lg hover:shadow-pink-500/10 hover:border-pink-300/50">
                    <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-500 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-pink-500 group-hover:text-white transition-colors duration-300">
                      <span className="material-symbols-rounded text-xl">palette</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">Colour the coral</h4>
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                        Colouring Activity
                      </span>
                    </div>
                    <span className="material-symbols-rounded ml-auto text-slate-400 group-hover:text-pink-500 transition-colors">
                      arrow_forward_ios
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Animated Mascot ── */}
          <div className="w-full md:w-56 shrink-0 flex flex-col items-center">
            <div className="w-48 h-48 relative drop-shadow-2xl">
              <div
                className="absolute inset-0 bg-gradient-to-br from-amber-300 to-orange-400 rounded-full shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.1),inset_10px_10px_20px_rgba(255,255,255,0.4)] animate-bounce"
                style={{ animationDuration: "3s" }}
              >
                {/* Eyes */}
                <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-white rounded-full shadow-inner flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-full" />
                </div>
                <div className="absolute top-1/4 right-1/4 w-8 h-8 bg-white rounded-full shadow-inner flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-full" />
                </div>
                {/* Mouth */}
                <div className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 w-10 h-4 bg-red-400/50 rounded-full" />
              </div>
              {/* Bubble decorations */}
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-300/80 rounded-full shadow-[inset_-5px_-5px_10px_rgba(0,0,0,0.1),inset_5px_5px_10px_rgba(255,255,255,0.4)] backdrop-blur-sm animate-pulse" />
              <div className="absolute bottom-0 -left-6 w-8 h-8 bg-blue-200/80 rounded-full shadow-[inset_-2px_-2px_5px_rgba(0,0,0,0.1),inset_2px_2px_5px_rgba(255,255,255,0.4)] backdrop-blur-sm" />
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-6 text-center">
              Sunny is excited!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LessonGenerator;
