import { useState, useEffect } from 'react';
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import ReportCard from '@/components/dashboard/ReportCard';

function asDate(value) {
  if (!value) return new Date(0);
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

export default function ReportTab({ studentId, studentName }) {
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysisResultsCount, setAnalysisResultsCount] = useState(0);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    const fetch = async () => {
      try {
        const q = query(
          collection(db, 'reports'),
          where('studentId', '==', studentId),
          limit(10)
        );
        const snap = await getDocs(q);
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const right = b.generatedAtISO || b.generatedAt;
            const left = a.generatedAtISO || a.generatedAt;
            return asDate(right) - asDate(left);
          });

        // Also fetch analysis results count for the min-3 gate
        const analysisQ = query(
          collection(db, 'analysisResults'),
          where('studentId', '==', studentId),
          limit(100)
        );
        const analysisSnap = await getDocs(analysisQ);
        let nextCount = analysisSnap.size;

        if (nextCount === 0) {
          const studentDocSnap = await getDoc(doc(db, 'students', studentId));
          const uid = studentDocSnap.exists() ? studentDocSnap.data()?.uid : null;
          if (uid) {
            const byUidQ = query(
              collection(db, 'analysisResults'),
              where('studentId', '==', uid),
              limit(100)
            );
            const byUidSnap = await getDocs(byUidQ);
            nextCount = byUidSnap.size;
          }
        }

        if (!cancelled) {
          setReports(data);
          setCurrentReport(data[0] || null);
          setAnalysisResultsCount(nextCount);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading reports:', err.message);
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [studentId]);

  const handleReportGenerated = (newReport) => {
    if (!newReport) return;
    setCurrentReport(newReport);
    setReports((prev) => {
      const withoutCurrent = prev.filter((r) => r.id !== newReport.id);
      return [newReport, ...withoutCurrent];
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current/New Report */}
      <ReportCard
        report={currentReport}
        studentName={studentName}
        studentId={studentId}
        onReportGenerated={handleReportGenerated}
        analysisResultsCount={analysisResultsCount}
      />

      {/* Past Reports */}
      {reports.length > 1 && (
        <div>
          <h3 className="font-semibold text-foreground mb-3">Past Reports</h3>
          <div className="space-y-2">
            {reports.slice(1).map((report) => (
              <button
                key={report.id}
                onClick={() => setCurrentReport(report)}
                className={`btn btn-block h-auto justify-start text-left normal-case p-4 rounded-lg border transition-all ${
                  currentReport?.id === report.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground text-sm">
                    {report.weekStartDate ? `Week of ${report.weekStartDate}` : 'Report'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {report.generatedAt?.toDate
                      ? report.generatedAt.toDate().toLocaleDateString()
                      : report.generatedAtISO
                        ? new Date(report.generatedAtISO).toLocaleDateString()
                        : ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {report.narrativeSummary?.slice(0, 120)}...
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
