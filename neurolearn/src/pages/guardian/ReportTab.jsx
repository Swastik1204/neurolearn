import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import ReportCard from '@/components/dashboard/ReportCard';

export default function ReportTab({ studentId, studentName }) {
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    const fetch = async () => {
      try {
        const q = query(
          collection(db, 'reports'),
          where('studentId', '==', studentId),
          orderBy('generatedAt', 'desc'),
          limit(10)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!cancelled) {
          setReports(data);
          setCurrentReport(data[0] || null);
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
    setCurrentReport(newReport);
    setReports((prev) => [newReport, ...prev]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
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
                className={`w-full text-left p-4 rounded-lg border transition-all ${
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
                    {report.generatedAt?.toDate ? report.generatedAt.toDate().toLocaleDateString() : ''}
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
