import { Link } from "react-router-dom";
import LessonGenerator from "../components/LessonGenerator.jsx";
import EmotionVisualizer from "../components/EmotionVisualizer.jsx";

function Home() {
  return (
    <div className="grid gap-8">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-200 via-white to-pink-100 p-8 shadow-lg">
        <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">
          NeuroLearn — A gentle AI tutor for neurodivergent superstars
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Generate playful stories, handwriting activities, and calming
          exercises in real-time. NeuroLearn listens to each brush stroke,
          colour choice, and smile to personalise the next step.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/learn" className="btn btn-primary btn-wide">
            Start adaptive session
          </Link>
          <Link to="/draw" className="btn btn-outline btn-wide">
            Practice handwriting
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <LessonGenerator />
        <EmotionVisualizer />
      </div>
    </div>
  );
}

export default Home;
