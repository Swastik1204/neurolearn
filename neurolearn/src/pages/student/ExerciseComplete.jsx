import { Link, useLocation } from 'react-router-dom';
import { PartyPopper, Home, RotateCcw, Star } from 'lucide-react';

export default function ExerciseComplete() {
  const location = useLocation();
  const { letterResults } = location.state || { letterResults: [] };

  const highRiskLetters = letterResults
    .filter(r => r.risk_level === 'high')
    .map(r => r.letter);

  return (
    <div className="min-h-screen bg-background student-view flex items-center justify-center py-12 px-6">
      <div className="text-center animate-fade-in max-w-2xl w-full">
        <div className="w-24 h-24 rounded-full gradient-accent flex items-center justify-center mx-auto mb-6 shadow-xl animate-scale-in">
          <PartyPopper className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-4">
          Great job! 🎉
        </h1>

        <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-md mx-auto">
          {letterResults.length > 0 
            ? `You finished all ${letterResults.length} letters! Here is how you did today.`
            : "You finished all the letter tracing exercises! You're doing amazing."}
        </p>

        {letterResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {/* Summary Highlights */}
            {highRiskLetters.length > 0 && (
              <div className="sm:col-span-2 bg-destructive/5 border border-destructive/20 rounded-2xl p-4 text-left flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h4 className="font-bold text-destructive">Focus Letters for Next Time</h4>
                  <p className="text-sm text-destructive/80">
                    Practice the letters {highRiskLetters.join(', ')} to boost your skills.
                  </p>
                </div>
              </div>
            )}

            {/* Per-letter cards */}
            {letterResults.map((res, idx) => (
              <div 
                key={idx} 
                className={`p-5 rounded-2xl border-2 text-left flex items-center gap-5 transition-all hover:shadow-md ${
                  res.risk_level === 'low' ? 'bg-success/5 border-success/20' :
                  res.risk_level === 'medium' ? 'bg-warning/5 border-warning/20' :
                  res.risk_level === 'high' ? 'bg-destructive/5 border-destructive/20' :
                  'bg-muted/30 border-muted'
                }`}
              >
                <div 
                  className={`text-5xl font-bold select-none ${
                    res.risk_level === 'low' ? 'text-success' :
                    res.risk_level === 'medium' ? 'text-warning' :
                    res.risk_level === 'high' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}
                  style={{ fontFamily: '"OpenDyslexic", sans-serif' }}
                >
                  {res.letter}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className={`font-bold text-sm uppercase tracking-wider ${
                    res.risk_level === 'low' ? 'text-success' :
                    res.risk_level === 'medium' ? 'text-warning' :
                    res.risk_level === 'high' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {res.risk_level === 'low' ? 'Excellent' : 
                     res.risk_level === 'medium' ? 'Good' : 
                     res.risk_level === 'high' ? 'Needs Focus' : 'Pending'}
                  </h5>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 italic">
                    {res.note || (res.risk_level === 'pending' ? 'Analysis processing...' : 'Formation analysis complete.')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-10 p-6 bg-muted/30 rounded-2xl border-2 border-dashed border-muted shadow-inner animate-slide-up">
            <p className="text-muted-foreground font-medium italic">
              Check the guardian dashboard in a few minutes for full results.
            </p>
          </div>
        )}

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
