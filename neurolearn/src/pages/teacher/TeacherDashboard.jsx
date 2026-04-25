import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { query, collection, where, getDocs } from 'firebase/firestore';
import useCurrentUser from '@/hooks/useCurrentUser';
import AssignExercise from './AssignExercise';
import RiskDistribution from '@/components/charts/RiskDistribution';
import OverviewTab from '@/pages/guardian/OverviewTab';
import {
  BookOpen, LogOut, ClipboardList, Users, UserPlus, X
} from 'lucide-react';
import StudentListPanel from '@/components/StudentListPanel';

const clamp01 = (v, fb = 0.5) => {
  const n = Number(v);
  return Number.isNaN(n) ? fb : Math.min(1, Math.max(0, n));
};

const pathSuggestion = {
  reversal_reinforcement: 'Suggested class activity: try tracing B and D side by side to feel the difference.',
  motor_development: 'Suggested class activity: practice slow, careful strokes — quality over speed.',
  consistency_building: 'Suggested class activity: repeat the same letter 5 times in a row.',
  confidence_pacing: 'Suggested class activity: take your time — there is no rush.',
};

const dimLabel = {
  writingMotor: 'Writing strength',
  reversalRisk: 'Letter accuracy',
  letterConsistency: 'Letter consistency',
  strokeConfidence: 'Pen confidence',
};

const bandCfg = {
  low: 'text-success bg-success/10 border-success/30',
  moderate: 'text-warning bg-warning/10 border-warning/30',
  high: 'text-destructive bg-destructive/10 border-destructive/30',
};
const bandText = { low: 'Great progress', moderate: 'Building skills', high: 'Needs support' };

function scoreToBand(riskScore) {
  if (riskScore > 0.6) return 'high';
  if (riskScore > 0.3) return 'moderate';
  return 'low';
}

export default function TeacherDashboard() {
  const { user, studentIds } = useCurrentUser();
  const [students, setStudents] = useState([]);
  const [slideOutStudent, setSlideOutStudent] = useState(null);
  const [assignStudent, setAssignStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBrowsePanel, setShowBrowsePanel] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    const fetchStudents = async () => {
      try {
        setLoading(true);
        const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
        const studentsSnap = await getDocs(studentsQuery);
        const studentsData = [];

        for (const studentDoc of studentsSnap.docs) {
          const student = { id: studentDoc.id, ...studentDoc.data(), uid: studentDoc.id };

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
            student.riskScore = latestAnalysis?.scores?.overallRisk || 0;
            student.lastAnalysis = latestAnalysis;
            student.cognitiveProfile = latestAnalysis?.cognitiveProfile || null;

            if (student.cognitiveProfile) {
              const dims = [
                ['writingMotor', clamp01(student.cognitiveProfile.writingMotor)],
                ['letterConsistency', clamp01(student.cognitiveProfile.letterConsistency)],
                ['strokeConfidence', clamp01(student.cognitiveProfile.strokeConfidence)],
                ['reversalRisk', 1 - clamp01(student.cognitiveProfile.reversalRisk)],
              ];
              student.weakestDim = dims.sort((a, b) => a[1] - b[1])[0][0];
              student.recommendedPath = student.cognitiveProfile.recommendedPath || null;
              student.sessionRiskBand = student.cognitiveProfile.riskBand || null;
            }
          } catch (error) {
            console.debug('Could not load analysis for student:', error?.message);
            student.riskScore = 0;
          }

          try {
            const sessQ = query(
              collection(db, 'sessions'),
              where('studentId', '==', student.uid)
            );
            const sessSnap = await getDocs(sessQ);
            student.sessionCount = sessSnap.size;
            student.lastSessionDate = sessSnap.docs[0]?.data()?.startedAt;
          } catch (error) {
            console.debug('Could not load sessions for student:', error?.message);
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
  }, [user?.uid, studentIds]);

  // ── Class-level computations ──
  const riskDistribution = [
    { name: 'Low Risk', value: students.filter((s) => s.riskScore <= 0.3).length },
    { name: 'Medium Risk', value: students.filter((s) => s.riskScore > 0.3 && s.riskScore <= 0.6).length },
    { name: 'High Risk', value: students.filter((s) => s.riskScore > 0.6).length },
  ];

  const classBandCounts = { low: 0, moderate: 0, high: 0 };
  students.forEach((s) => {
    const b = s.sessionRiskBand || scoreToBand(s.riskScore);
    classBandCounts[b] = (classBandCounts[b] || 0) + 1;
  });

  const dimFreq = {};
  students.forEach((s) => {
    if (s.weakestDim) dimFreq[s.weakestDim] = (dimFreq[s.weakestDim] || 0) + 1;
  });
  const commonWeakestDim = Object.entries(dimFreq).sort((a, b) => b[1] - a[1])[0] || null;

  const pathFreq = {};
  students.forEach((s) => {
    if (s.recommendedPath) pathFreq[s.recommendedPath] = (pathFreq[s.recommendedPath] || 0) + 1;
  });
  const commonPath = Object.entries(pathFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

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

            {/* ── Class summary ── */}
            {students.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 card bg-base-100 border border-border shadow-sm">
                  <div className="card-body">
                    <h2 className="font-semibold text-foreground mb-3">Class overview</h2>
                    <div className="flex gap-3 flex-wrap">
                      {(['low', 'moderate', 'high']).map((band) => (
                        <div key={band} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${bandCfg[band]}`}>
                          <span className="text-2xl font-black">{classBandCounts[band]}</span>
                          <span>{bandText[band]}</span>
                        </div>
                      ))}
                    </div>
                    {commonWeakestDim && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Most common focus area: <strong>{dimLabel[commonWeakestDim[0]] || commonWeakestDim[0]}</strong>
                        {' '}({commonWeakestDim[1]} student{commonWeakestDim[1] !== 1 ? 's' : ''})
                      </p>
                    )}
                    {commonPath && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {pathSuggestion[commonPath]}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <RiskDistribution data={riskDistribution} />
                </div>
              </div>
            )}

            {/* ── Class roster ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Class Roster</h2>
                <button
                  onClick={() => setShowBrowsePanel(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all font-medium text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Link Student
                </button>
              </div>

              {students.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No students assigned to your class yet.</p>
                  <button
                    onClick={() => setShowBrowsePanel(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90 transition-all font-medium text-sm shadow-sm"
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
                        <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk band</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Weakest area</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Sessions</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {students.map((student) => {
                        const band = student.sessionRiskBand || scoreToBand(student.riskScore);
                        return (
                          <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <button
                                onClick={() => setSlideOutStudent(slideOutStudent?.id === student.id ? null : student)}
                                className="flex items-center gap-2 text-left w-full"
                              >
                                <span className="font-medium text-foreground">{student.displayName || 'Student'}</span>
                                <span className="text-xs text-primary underline ml-1">view</span>
                              </button>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                              {student.lastSessionDate?.toDate
                                ? student.lastSessionDate.toDate().toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${bandCfg[band] || 'text-muted-foreground border-border bg-muted'}`}>
                                {bandText[band] || band}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground hidden lg:table-cell">
                              {student.weakestDim ? (dimLabel[student.weakestDim] || student.weakestDim) : '—'}
                            </td>
                            <td className="py-3 px-4 text-center text-sm text-foreground hidden sm:table-cell">
                              {student.sessionCount || 0}
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
          </div>
        )}
      </main>

      {/* ── Slide-out student OverviewTab panel ── */}
      {slideOutStudent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSlideOutStudent(null)}
          />
          <div className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl overflow-y-auto p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">
                {slideOutStudent.displayName || 'Student'}
              </h2>
              <button
                onClick={() => setSlideOutStudent(null)}
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-all"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <OverviewTab studentId={slideOutStudent.uid || slideOutStudent.id} />
          </div>
        </div>
      )}

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
          linkedStudentIds={studentIds || []}
          onClose={() => setShowBrowsePanel(false)}
        />
      )}
    </div>
  );
}
