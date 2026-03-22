import { Link } from 'react-router-dom';
import { PartyPopper, Home, RotateCcw } from 'lucide-react';

export default function ExerciseComplete() {
  return (
    <div className="min-h-screen bg-background student-view flex items-center justify-center px-6">
      <div className="text-center animate-fade-in max-w-md">
        <div className="w-24 h-24 rounded-full gradient-accent flex items-center justify-center mx-auto mb-8 shadow-xl animate-scale-in">
          <PartyPopper className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-4">
          Great job! 🎉
        </h1>

        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          You finished all the writing exercises! You&apos;re doing amazing.
          Keep up the great work!
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/student/exercise"
            className="flex items-center gap-2 px-8 py-4 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg text-lg"
          >
            <RotateCcw className="w-5 h-5" />
            Practice Again
          </Link>

          <Link
            to="/student"
            className="flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:bg-muted transition-all text-lg"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
