import LessonGenerator from "../components/LessonGenerator.jsx";
import ProgressDashboard from "../components/ProgressDashboard.jsx";

function Learn() {
  return (
    <div className="grid gap-8">
      <section className="rounded-3xl bg-base-100 p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-slate-800">
          Adaptive lesson studio
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Every session blends handwriting analysis, emotion tracking, and
          positive reinforcement. Update the configuration in `utils/genAI.js`
          to point at your favourite LLM provider. The planner builds the next
          three lessons and stores them in Firestore.
        </p>
      </section>

      <LessonGenerator autoStart={false} />

      <ProgressDashboard />
    </div>
  );
}

export default Learn;
