import { Link } from 'react-router-dom';
import useCurrentUser from '@/hooks/useCurrentUser';
import { PenTool, BookOpen, Star, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useState } from 'react';
import axios from 'axios';

export default function StudentHome() {
  const { user } = useCurrentUser();
  const [lessonText, setLessonText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const testGemini = async () => {
    setLoading(true);
    try {
      // Safely proxy request to backend API to protect the Gemini Key
      const idToken = await auth.currentUser.getIdToken();
      const response = await axios.post('/api/generate-lesson', 
        { topic: 'phonics', difficulty: 'easy', childName: user?.displayName || 'Student' },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      setLessonText(response.data.lesson || "Lesson loaded successfully!");
    } catch (e) {
      setLessonText("API Error: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background student-view">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">NeuroLearn</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Hi, {user?.displayName?.split(' ')[0] || 'Student'}! 👋
            </span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Ready to practice? ✨
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose an activity to get started
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Writing Exercise Card */}
          <Link
            to="/student/exercise"
            className="group block p-8 bg-card rounded-2xl border-2 border-border hover:border-primary/50 shadow-md hover:shadow-xl transition-all"
          >
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <PenTool className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Writing Practice</h2>
            <p className="text-muted-foreground leading-relaxed">
              Practice writing words with your finger or a stylus. Take your time — there's no rush!
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-primary font-medium">
              Start writing →
            </div>
          </Link>

          {/* AI Lesson Generator Card */}
          <div className="p-8 bg-card rounded-2xl border-2 border-border shadow-md">
            <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mb-5">
              <Star className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">AI Mini-Lesson</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {lessonText ? lessonText : "Click below to generate a quick encouraging lesson from Gemini AI!"}
            </p>
            <button
               onClick={testGemini}
               disabled={loading}
               className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {loading ? "Generating..." : "Generate AI Lesson"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
