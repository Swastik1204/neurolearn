import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { collection, query, where, getDocs, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import useCurrentUser from '@/hooks/useCurrentUser';
import OverviewTab from './OverviewTab';
import HandwritingTab from './HandwritingTab';
import ReportTab from './ReportTab';
import BehaviourTab from './BehaviourTab';
import StudentListPanel from '@/components/StudentListPanel';
import {
  BookOpen, LogOut, LayoutDashboard, PenTool, FileText, Activity,
  ChevronDown, Users, UserPlus, Check,
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
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showBrowsePanel, setShowBrowsePanel] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch linked students
  useEffect(() => {
    if (!studentIds?.length) {
      setLoading(false);
      return;
    }

    const fetchStudents = async () => {
      try {
        const studentsData = [];
        for (const sid of studentIds) {
          // studentIds contains doc IDs from /students collection
          const studentDocRef = firestoreDoc(db, 'students', sid);
          const studentSnap = await getDoc(studentDocRef);
          if (studentSnap.exists()) {
            const data = { id: studentSnap.id, ...studentSnap.data() };

            // Enrich with email from /users collection
            if (data.uid) {
              try {
                const userSnap = await getDoc(firestoreDoc(db, 'users', data.uid));
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  data.email = userData.email || '';
                  data.displayName = data.displayName || userData.displayName || 'Student';
                }
              } catch (_) {}
            }

            studentsData.push(data);
          }
        }

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
              <span className="font-bold text-lg text-foreground">NeuroLearn</span>
              <span className="text-sm text-muted-foreground ml-2">Guardian</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Student Button with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowStudentDropdown(!showStudentDropdown)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                  showStudentDropdown
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-input bg-background text-foreground hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Student</span>
                {students.length > 0 && (
                  <span className="ml-0.5 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                    {students.length}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showStudentDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Panel */}
              {showStudentDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-xl border border-border shadow-xl overflow-hidden animate-scale-in z-50">
                  {students.length === 0 ? (
                    <div className="p-4 text-center">
                      <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">No students connected yet.</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-3 pt-3 pb-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                          Connected Students
                        </p>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {students.map((s) => {
                          const isSelected = (s.uid || s.id) === selectedStudentId;
                          const initial = (s.displayName || '?')[0].toUpperCase();
                          return (
                            <button
                              key={s.id}
                              onClick={() => {
                                setSelectedStudentId(s.uid || s.id);
                                setShowStudentDropdown(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-muted/60 ${
                                isSelected ? 'bg-primary/8' : ''
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                              }`}>
                                {initial}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  isSelected ? 'text-primary' : 'text-foreground'
                                }`}>
                                  {s.displayName || 'Student'}
                                </p>
                                {s.email && (
                                  <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Browse All Students action */}
                  <div className="border-t border-border p-2">
                    <button
                      onClick={() => {
                        setShowStudentDropdown(false);
                        setShowBrowsePanel(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      Browse All Students
                    </button>
                  </div>
                </div>
              )}
            </div>

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

      {/* Student Selector Strip — visible when multiple students are linked */}
      {students.length > 1 && selectedStudentId && (
        <div className="bg-muted/30 border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Viewing:
              </span>
              {students.map((s) => {
                const uid = s.uid || s.id;
                const isSelected = uid === selectedStudentId;
                const initial = (s.displayName || s.email || '?')[0].toUpperCase();
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(uid)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-card border border-border text-foreground hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    }`}>
                      {initial}
                    </span>
                    {s.displayName || 'Student'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
            <p className="text-muted-foreground mb-6">Browse available students and connect to view their progress.</p>
            <button
              onClick={() => setShowBrowsePanel(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-medium hover:shadow-lg transition-all shadow-md group"
            >
              <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Browse Students
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab key={selectedStudentId} studentId={selectedStudentId} />}
            {activeTab === 'handwriting' && <HandwritingTab key={selectedStudentId} studentId={selectedStudentId} />}
            {activeTab === 'reports' && (
              <ReportTab
                key={selectedStudentId}
                studentId={selectedStudentId}
                studentName={selectedStudent?.displayName || 'Student'}
              />
            )}
            {activeTab === 'behaviour' && <BehaviourTab key={selectedStudentId} studentId={selectedStudentId} />}
          </>
        )}
      </main>

      {showBrowsePanel && (
        <StudentListPanel
          role="guardian"
          linkedStudentIds={studentIds || []}
          onClose={() => setShowBrowsePanel(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
