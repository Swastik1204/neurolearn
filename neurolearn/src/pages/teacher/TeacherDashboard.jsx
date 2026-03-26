import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import useCurrentUser from '@/hooks/useCurrentUser';
import AssignExercise from './AssignExercise';
import RiskDistribution from '@/components/charts/RiskDistribution';
import {
  BookOpen, LogOut, ChevronDown, ChevronUp, ClipboardList,
  AlertCircle, CheckCircle, Clock, Users, UserPlus
} from 'lucide-react';
import StudentListPanel from '@/components/StudentListPanel';

function getRiskLevel(score) {
  if (score > 0.6) return { level: 'High', color: 'bg-risk-high', textColor: 'text-risk-high' };
  if (score > 0.3) return { level: 'Medium', color: 'bg-risk-medium', textColor: 'text-risk-medium' };
  return { level: 'Low', color: 'bg-risk-low', textColor: 'text-risk-low' };
}

export default function TeacherDashboard() {
  const { user, studentIds } = useCurrentUser();
  const [students, setStudents] = useState([]);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [assignStudent, setAssignStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBrowsePanel, setShowBrowsePanel] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    const fetchStudents = async () => {
      try {
        const q = query(
          collection(db, 'students'),
          where('teacherId', '==', user.uid)
        );
        const snap = await getDocs(q);
        const studentsData = [];

        for (const doc of snap.docs) {
          const student = { id: doc.id, ...doc.data() };

          // Fetch latest analysis result for risk level
          try {
            const analysisQ = query(
              collection(db, 'analysisResults'),
              where('studentId', '==', student.uid)
            );
            const analysisSnap = await getDocs(analysisQ);
            const sortedAnalysis = analysisSnap.docs
              .map(d => d.data())
              .sort((a, b) => (b.analyzedAt?.toMillis?.() || 0) - (a.analyzedAt?.toMillis?.() || 0));
            const latestAnalysis = sortedAnalysis[0];
            student.riskScore = latestAnalysis?.scores?.overallDyslexiaRisk || 0;
            student.lastAnalysis = latestAnalysis;
          } catch (e) {
            student.riskScore = 0;
          }

          // Fetch session count this week
          try {
            const sessQ = query(
              collection(db, 'sessions'),
              where('studentId', '==', student.uid)
            );
            const sessSnap = await getDocs(sessQ);
            student.sessionCount = sessSnap.size;
            student.lastSessionDate = sessSnap.docs[0]?.data()?.startedAt;
          } catch (e) {
            student.sessionCount = 0;
          }

          studentsData.push(student);
        }

        if (!cancelled) {
          setStudents(studentsData);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading class:', err.message);
        if (!cancelled) setLoading(false);
      }
    };

    fetchStudents();
    return () => { cancelled = true; };
  }, [user]);

  // Risk distribution for chart
  const riskDistribution = [
    { name: 'Low Risk', value: students.filter((s) => s.riskScore <= 0.3).length },
    { name: 'Medium Risk', value: students.filter((s) => s.riskScore > 0.3 && s.riskScore <= 0.6).length },
    { name: 'High Risk', value: students.filter((s) => s.riskScore > 0.6).length },
  ];

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
              <span className="text-sm text-muted-foreground ml-2">Teacher</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {students.length} student{students.length !== 1 ? 's' : ''}
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top row — stats + chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground">Class Roster</h2>
                  {students.length > 0 && (
                    <button
                      onClick={() => setShowBrowsePanel(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all font-medium text-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Link Student
                    </button>
                  )}
                </div>

                {students.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-xl border border-border">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">No students assigned to your class yet.</p>
                    <button
                      onClick={() => setShowBrowsePanel(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-all font-medium text-sm shadow-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      Link a Student
                    </button>
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Student</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Last Session</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Sessions</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {students.map((student) => {
                          const risk = getRiskLevel(student.riskScore);
                          const isExpanded = expandedStudent === student.id;

                          return (
                            <tr key={student.id} className="group">
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                                  className="flex items-center gap-2 text-left"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                  <span className="font-medium text-foreground">{student.displayName || 'Student'}</span>
                                </button>

                                {/* Expanded mini-report */}
                                {isExpanded && student.lastAnalysis && (
                                  <div className="mt-3 ml-6 p-4 bg-muted rounded-lg text-sm space-y-2 animate-slide-up">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <span className="text-muted-foreground">Letter Form:</span>{' '}
                                        <span className="font-medium">{student.lastAnalysis.scores?.letterFormScore || '—'}/100</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Spacing:</span>{' '}
                                        <span className="font-medium">{student.lastAnalysis.scores?.spacingScore || '—'}/100</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Baseline:</span>{' '}
                                        <span className="font-medium">{student.lastAnalysis.scores?.baselineScore || '—'}/100</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Reversals:</span>{' '}
                                        <span className="font-medium">{student.lastAnalysis.indicators?.reversals?.length || 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                                {student.lastSessionDate?.toDate
                                  ? student.lastSessionDate.toDate().toLocaleDateString()
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className={`w-2.5 h-2.5 rounded-full ${risk.color}`} />
                                  <span className={`text-xs font-medium ${risk.textColor}`}>{risk.level}</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center text-sm text-foreground hidden sm:table-cell">
                                {student.sessionCount}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => setAssignStudent(student)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-all"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                  Assign
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Risk Distribution Chart */}
              <div>
                <RiskDistribution data={riskDistribution} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Assign Exercise Modal */}
      {assignStudent && (
        <AssignExercise
          studentId={assignStudent.uid}
          studentName={assignStudent.displayName || 'Student'}
          onClose={() => setAssignStudent(null)}
        />
      )}

      {showBrowsePanel && (
        <StudentListPanel
          role="teacher"
          linkedStudentIds={studentIds || []}
          onClose={() => setShowBrowsePanel(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
