import { Link } from "react-router-dom";
import LessonGenerator from "../components/LessonGenerator.jsx";
import EmotionVisualizer from "../components/EmotionVisualizer.jsx";

function Home() {
  return (
    <div className="space-y-10">
      {/* ── Hero Section ── */}
      <section className="glass-panel rounded-3xl p-10 lg:p-14 relative overflow-hidden group">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/50 border border-white/60 backdrop-blur-sm mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Ready to learn
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-800 mb-6 leading-[1.1] tracking-tight">
            NeuroLearn — A gentle AI tutor for{" "}
            <br className="hidden lg:block" />
            <span className="text-gradient">neurodivergent superstars</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg lg:text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl font-light">
            Generate playful stories, handwriting activities, and calming
            exercises in real-time. Personalized for every smile and stroke.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-5">
            <Link
              to="/learn"
              className="px-8 py-4 bg-slate-900 text-white font-bold rounded-full shadow-lg shadow-[#6366f1]/20 hover:shadow-[#6366f1]/40 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3 text-base"
            >
              <span className="material-symbols-rounded">auto_awesome</span>
              Start adaptive session
            </Link>
            <Link
              to="/draw"
              className="px-8 py-4 bg-white/40 backdrop-blur-md border border-white/60 text-slate-800 font-bold rounded-full hover:bg-white/60 transition-all duration-300 flex items-center justify-center gap-3 text-base shadow-sm"
            >
              <span className="material-symbols-rounded">edit</span>
              Practice handwriting
            </Link>
          </div>
        </div>

        {/* Decorative blob SVG */}
        <div className="absolute right-0 bottom-0 opacity-30 translate-x-1/4 translate-y-1/4 pointer-events-none">
          <svg
            width="600"
            height="600"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-46.3C87.4,-33.5,90.1,-17.9,89.9,-2.4C89.7,13.1,86.6,28.5,78.3,41.4C70,54.3,56.5,64.6,42.1,73.1C27.7,81.6,12.4,88.3,-2.3,92.3C-17,96.3,-31.1,97.6,-44.6,90.7C-58.1,83.8,-71,68.7,-79.8,52.3C-88.6,35.9,-93.3,18.2,-91.7,1.2C-90.1,-15.8,-82.2,-32.1,-71.4,-45.8C-60.6,-59.5,-46.9,-70.6,-32.3,-77.6C-17.7,-84.6,-2.2,-87.5,12.2,-85.4L44.7,-76.4Z"
              fill="#6366f1"
              transform="translate(100 100)"
            />
          </svg>
        </div>
      </section>

      {/* ── Content: Lesson + Emotion side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <LessonGenerator />
        </div>
        <div className="lg:col-span-4">
          <EmotionVisualizer />
        </div>
      </div>
    </div>
  );
}

export default Home;
