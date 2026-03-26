import { Link, useLocation } from 'react-router-dom';
import { PartyPopper, Home, RotateCcw, Star } from 'lucide-react';

export default function ExerciseComplete() {
  const location = useLocation();
  const { score, level } = location.state || { score: null, level: null };
  return (
    <div className="min-h-screen bg-background student-view flex items-center justify-center px-6">
      <div className="text-center animate-fade-in max-w-md">
        <div className="w-24 h-24 rounded-full gradient-accent flex items-center justify-center mx-auto mb-8 shadow-xl animate-scale-in">
          <PartyPopper className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2">
          Great job! 🎉
        </h1>

        {score !== null ? (
          <div className="mb-8 p-6 bg-card rounded-2xl border-2 border-primary/20 shadow-sm animate-slide-up">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="w-5 h-5 text-primary fill-primary" />
              <span className="font-bold text-foreground uppercase tracking-wider text-sm">Session Score</span>
            </div>
            <div className="text-5xl font-black text-primary mb-1">
              {Math.round((1 - score) * 100)}%
            </div>
            <div className={`text-sm font-semibold px-3 py-1 rounded-full inline-block ${
              level === 'low' ? 'bg-success/10 text-success' : 
              level === 'medium' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
            }`}>
              {level === 'low' ? 'Excellent Form' : level === 'medium' ? 'Good Effort' : 'Keep Practicing'}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-6 bg-muted/30 rounded-2xl border-2 border-dashed border-muted shadow-inner animate-slide-up">
            <p className="text-muted-foreground font-medium italic">
              Your handwriting has been submitted for analysis. <br />
              Check the guardian dashboard in a few minutes for results.
            </p>
          </div>
        )}

        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
          You finished all the letter tracing exercises! You&apos;re doing amazing.
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
