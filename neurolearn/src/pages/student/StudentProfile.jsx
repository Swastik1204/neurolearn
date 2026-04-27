import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';
import { 
  User, 
  Award, 
  Clock, 
  Calendar, 
  ChevronRight, 
  ArrowLeft,
  Trophy,
  Target,
  Zap
} from 'lucide-react';

export default function StudentProfile() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
    avgMotor: 0,
    avgConsistency: 0,
    bestLetter: 'None',
    recentSessions: []
  });

  useEffect(() => {
    async function fetchStats() {
      if (!user?.uid) return;
      
      try {
        const sessionsRef = collection(db, 'sessions');
        const q = query(
          sessionsRef, 
          where('studentId', '==', user.uid),
          orderBy('endedAt', 'desc')
        );
        
        const snap = await getDocs(q);
        const sessionList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (sessionList.length > 0) {
          const totalDuration = sessionList.reduce((acc, s) => acc + (s.durationMs || 0), 0);
          
          // Calculate averages from cognitive profiles
          const profiles = sessionList.map(s => s.cognitiveProfile).filter(Boolean);
          const motorTotal = profiles.reduce((acc, p) => acc + (p.writingMotor || 0), 0);
          const consistencyTotal = profiles.reduce((acc, p) => acc + (p.letterConsistency || 0), 0);
          
          // Find best letter (most frequent with low risk)
          const resultsRef = collection(db, 'analysisResults');
          const resultsQ = query(resultsRef, where('studentId', '==', user.uid));
          const resultsSnap = await getDocs(resultsQ);
          const results = resultsSnap.docs.map(doc => doc.data());
          
          const letterStats = {};
          results.forEach(r => {
            if (!letterStats[r.letter]) letterStats[r.letter] = { count: 0, score: 0 };
            letterStats[r.letter].count++;
            letterStats[r.letter].score += (r.scores?.letterFormScore || 0);
          });
          
          let best = 'None';
          let maxScore = -1;
          Object.entries(letterStats).forEach(([letter, data]) => {
            const avg = data.score / data.count;
            if (avg > maxScore) {
              maxScore = avg;
              best = letter;
            }
          });

          setStats({
            totalSessions: sessionList.length,
            totalDuration: Math.round(totalDuration / 60000), // to minutes
            avgMotor: profiles.length ? Math.round((motorTotal / profiles.length) * 100) : 0,
            avgConsistency: profiles.length ? Math.round((consistencyTotal / profiles.length) * 100) : 0,
            bestLetter: best,
            recentSessions: sessionList.slice(0, 5)
          });
        }
      } catch (err) {
        console.error('Error fetching student stats:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStats();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center student-view">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background student-view">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/student')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all group"
          >
            <div className="p-2 rounded-full group-hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="font-medium">Back to Home</span>
          </button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <User className="w-5 h-5 text-primary" />
             </div>
             <span className="font-bold text-foreground">My Profile</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Profile Card */}
        <div className="relative mb-10 animate-float">
           <div className="absolute inset-0 gradient-primary opacity-20 blur-3xl -z-10 rounded-full" />
           <div className="premium-card p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5">
               <Trophy className="w-32 h-32" />
             </div>
             
             <div className="flex flex-col md:flex-row items-center gap-8">
               <div className="relative">
                 <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center shadow-lg">
                    <User className="w-12 h-12 text-white" />
                 </div>
                 <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-accent flex items-center justify-center border-4 border-card shadow-md">
                   <Zap className="w-5 h-5 text-white" />
                 </div>
               </div>
               
               <div className="text-center md:text-left">
                 <h1 className="text-3xl font-black text-foreground mb-2">
                   {user?.displayName || 'Super Student'}
                 </h1>
                 <p className="text-muted-foreground font-medium mb-4">
                   Keep shining! You're doing amazing work. ✨
                 </p>
                 <div className="flex flex-wrap justify-center md:justify-start gap-3">
                   <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                     Active Learner
                   </div>
                   <div className="px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-wider">
                     Level 5
                   </div>                     <button 
                       onClick={() => navigate('/student/screening')}
                       className="px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
                     >
                       Take Manual Screening
                     </button>                 </div>
               </div>
             </div>
           </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard 
            icon={<Award className="w-5 h-5" />} 
            label="Best Letter" 
            value={stats.bestLetter} 
            color="bg-amber-500" 
            delay="100ms"
          />
          <StatCard 
            icon={<Target className="w-5 h-5" />} 
            label="Motor Skill" 
            value={`${stats.avgMotor}%`} 
            color="bg-emerald-500" 
            delay="200ms"
          />
          <StatCard 
            icon={<Zap className="w-5 h-5" />} 
            label="Consistency" 
            value={`${stats.avgConsistency}%`} 
            color="bg-indigo-500" 
            delay="300ms"
          />
          <StatCard 
            icon={<Clock className="w-5 h-5" />} 
            label="Minutes" 
            value={stats.totalDuration} 
            color="bg-rose-500" 
            delay="400ms"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Recent Practice
            </h2>
            
            <div className="space-y-4">
              {stats.recentSessions.length > 0 ? (
                stats.recentSessions.map(session => (
                  <div 
                    key={session.id}
                    className="premium-card p-5 flex items-center justify-between group cursor-default"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center font-bold text-primary">
                        {session.letters?.[0] || 'A'}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">
                          {session.letters?.join(', ') || 'Practice Session'}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {session.endedAt?.toDate ? session.endedAt.toDate().toLocaleDateString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div className="hidden sm:block">
                        <p className="text-xs font-bold text-muted-foreground uppercase">Risk Level</p>
                        <span className={`text-xs font-black uppercase ${
                          session.sessionRiskBand === 'low' ? 'text-success' : 
                          session.sessionRiskBand === 'high' ? 'text-destructive' : 'text-warning'
                        }`}>
                          {session.sessionRiskBand || 'low'}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-muted/30 rounded-3xl border-2 border-dashed border-border">
                  <p className="text-muted-foreground font-medium">No practice sessions yet. Let's start one!</p>
                </div>
              )}
            </div>
          </div>

          {/* Goals / Achievements */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Achievements
            </h2>
            
            <div className="space-y-4">
              <Achievement 
                title="Early Bird" 
                desc="Completed 5 sessions" 
                unlocked={stats.totalSessions >= 5} 
              />
              <Achievement 
                title="Steady Hand" 
                desc="80%+ Motor Skill" 
                unlocked={stats.avgMotor >= 80} 
              />
              <Achievement 
                title="Marathoner" 
                desc="30 mins total practice" 
                unlocked={stats.totalDuration >= 30} 
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color, delay }) {
  return (
    <div className="premium-card p-5 animate-slide-up" style={{ animationDelay: delay }}>
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3 shadow-lg`}>
        {icon}
      </div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

function Achievement({ title, desc, unlocked }) {
  return (
    <div className={`p-4 rounded-2xl border-2 transition-all ${
      unlocked ? 'bg-accent/5 border-accent/20 opacity-100' : 'bg-muted/20 border-border opacity-40 grayscale'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${unlocked ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}>
          <Trophy className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-sm text-foreground leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
    </div>
  );
}
