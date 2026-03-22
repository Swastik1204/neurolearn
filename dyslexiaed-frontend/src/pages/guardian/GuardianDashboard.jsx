import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import useCurrentUser from '@/hooks/useCurrentUser';
import OverviewTab from './OverviewTab';
import HandwritingTab from './HandwritingTab';
import ReportTab from './ReportTab';
import BehaviourTab from './BehaviourTab';
import {
  BookOpen, LogOut, LayoutDashboard, PenTool, FileText, Activity,
  ChevronDown,
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'handwriting', label: 'Handwriting', icon: PenTool },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'behaviour', label: 'Behaviour', icon: Activity },
];

export default function GuardianDashboard() {
  const { user, studentIds } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch linked students
  useEffect(() => {
    if (!studentIds?.length) {
      setLoading(false);
      return;
    }

    const fetchStudents = async () => {
      try {
        // Fetch student profiles
        const studentsData = [];
        for (const sid of studentIds) {
          const q = query(collection(db, 'students'), where('uid', '==', sid));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => studentsData.push({ id: d.id, ...d.data() }));
        }

        // If no student documents found, use the IDs directly
        if (studentsData.length === 0) {
          setStudents(studentIds.map((sid) => ({ id: sid, uid: sid, displayName: 'Student' })));
        } else {
          setStudents(studentsData);
        }

        setSelectedStudentId(studentsData[0]?.uid || studentIds[0]);
      } catch (err) {
        console.error('Error loading students:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [studentIds]);

  const selectedStudent = students.find((s) => s.uid === selectedStudentId || s.id === selectedStudentId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-foreground">DyslexiaEd</span>
              <span className="text-sm text-muted-foreground ml-2">Guardian</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Student selector */}
            {students.length > 1 && (
              <div className="relative">
                <select
                  value={selectedStudentId || ''}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="appearance-none px-4 py-2 pr-8 rounded-lg border border-input bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.uid || s.id}>
                      {s.displayName || 'Student'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            )}

            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.displayName || user?.email}
            </span>
            <button
              onClick={() => signOut(auth)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1" role="tablist">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : !selectedStudentId ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No students linked</h2>
            <p className="text-muted-foreground">Link a student to your account to view their progress.</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab studentId={selectedStudentId} />}
            {activeTab === 'handwriting' && <HandwritingTab studentId={selectedStudentId} />}
            {activeTab === 'reports' && (
              <ReportTab
                studentId={selectedStudentId}
                studentName={selectedStudent?.displayName || 'Student'}
              />
            )}
            {activeTab === 'behaviour' && <BehaviourTab studentId={selectedStudentId} />}
          </>
        )}
      </main>
    </div>
  );
}
