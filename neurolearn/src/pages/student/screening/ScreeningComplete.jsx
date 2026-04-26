import { useNavigate } from 'react-router-dom';
import Disclaimer from '@/components/Disclaimer';

export default function ScreeningComplete() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background student-view px-6 py-10">
      <main className="max-w-2xl mx-auto">
        <div className="rounded-3xl border border-border bg-card shadow-sm p-8 text-center animate-fade-in">
          <div className="text-7xl leading-none mb-4">🌟</div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Amazing work! You finished!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your guardian can now see your learning profile.
          </p>

          <button
            type="button"
            onClick={() => navigate('/student')}
            className="px-6 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-all shadow-md"
          >
            Start Learning →
          </button>
        </div>

        <Disclaimer />
      </main>
    </div>
  );
}
