import { useEffect, useState } from "react";
import { FaMagic } from "react-icons/fa";
import { HiMiniArrowPath } from "react-icons/hi2";
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
    <section className="rounded-3xl bg-base-100 p-6 shadow-lg">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="btn btn-circle btn-primary btn-sm">
            <FaMagic size={16} />
          </span>
          <div>
            <h3 className="text-lg font-bold text-slate-700">
              Today&apos;s adventure
            </h3>
            <p className="text-sm text-slate-500">
              Custom-tailored learning prompts powered by your preferred LLM.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={requestLesson}
          disabled={isLoading}
        >
          <HiMiniArrowPath
            className={isLoading ? "animate-spin" : ""}
            size={18}
          />
          {isLoading ? "Thinking…" : "New lesson"}
        </button>
      </header>

      {error && (
        <div className="alert alert-error mt-4 text-sm">
          <span>
            LLM request failed. Check API keys inside `utils/genAI.js`.
          </span>
        </div>
      )}

      <article className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-slate-700">
        {lesson ? (
          <>
            <h4 className="text-lg font-semibold text-indigo-700">
              {lesson.title}
            </h4>
            <p className="mt-2 leading-relaxed">{lesson.story}</p>
            <ul className="mt-4 space-y-2">
              {lesson.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="rounded-xl bg-white/70 p-3 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-700">
                    {activity.prompt}
                  </p>
                  <p className="text-xs text-slate-500">{activity.mode}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Press &ldquo;New lesson&rdquo; to pull a personalised alphabet or
            story prompt. The helper uses performance + emotion context to adapt
            the difficulty.
          </p>
        )}
      </article>
    </section>
  );
}

export default LessonGenerator;
