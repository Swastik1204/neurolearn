import { useState } from 'react';
import ReportCard from '@/components/dashboard/ReportCard';
import useStudentData from '@/hooks/useStudentData';
import Disclaimer from '@/components/Disclaimer';

const trendConfig = {
  improving: { label: 'Improving ↑', cls: 'text-success bg-success/10 border-success/30' },
  stable: { label: 'Stable →', cls: 'text-warning bg-warning/10 border-warning/30' },
  declining: { label: 'Needs attention ↓', cls: 'text-destructive bg-destructive/10 border-destructive/30' },
};

const clamp01 = (v, fb = 0.5) => {
  const n = Number(v);
  return Number.isNaN(n) ? fb : Math.min(1, Math.max(0, n));
};

function ProfileMini({ profile }) {
  if (!profile) return null;
  const dims = [
    { label: 'Writing strength', value: Math.round(clamp01(profile.writingMotor) * 100) },
    { label: 'Letter consistency', value: Math.round(clamp01(profile.letterConsistency) * 100) },
    { label: 'Pen confidence', value: Math.round(clamp01(profile.strokeConfidence) * 100) },
    { label: 'Letter accuracy', value: Math.round(clamp01(1 - clamp01(profile.reversalRisk)) * 100) },
  ];
  return (
    <div className="card bg-base-100 border border-border shadow-sm">
      <div className="card-body">
        <h3 className="font-semibold text-foreground mb-3">Week profile summary</h3>
        <div className="space-y-3">
          {dims.map((d) => (
            <div key={d.label}>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{d.label}</span><span>{d.value}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${d.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReportTab({ studentId, studentName }) {
  const { reports = [], analysisResults = [], summary, loading } = useStudentData(studentId);
  const [generatedReports, setGeneratedReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);

  const visibleReports = [...generatedReports, ...reports];
  const currentReport = visibleReports.find((r) => r.id === selectedReportId) || visibleReports[0] || null;

  const handleReportGenerated = (newReport) => {
    if (!newReport) return;
    setGeneratedReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)]);
    setSelectedReportId(newReport.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (analysisResults.length < 2) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground text-center">
          Complete at least 2 sessions to generate a weekly report.
        </div>
        <Disclaimer />
      </div>
    );
  }

  const trend = currentReport?.trend || null;
  const trendInfo = trend ? trendConfig[trend] : null;
  const reportProfile = currentReport?.overallProfile || summary?.overallProfile || null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current / new report */}
      <ReportCard
        report={currentReport}
        studentName={studentName}
        studentId={studentId}
        onReportGenerated={handleReportGenerated}
        analysisResultsCount={analysisResults.length}
      />

      {/* Trend indicator */}
      {trendInfo && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${trendInfo.cls}`}>
          Trend this week: {trendInfo.label}
        </div>
      )}

      {/* Week profile summary */}
      {reportProfile && <ProfileMini profile={reportProfile} />}

      {/* Past reports */}
      {visibleReports.length > 1 && (
        <div>
          <h3 className="font-semibold text-foreground mb-3">Past Reports</h3>
          <div className="space-y-2">
            {visibleReports.slice(1).map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className={`btn btn-block h-auto justify-start text-left normal-case p-4 rounded-lg border transition-all ${
                  currentReport?.id === report.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between w-full">
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
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 w-full">
                  {report.narrativeSummary?.slice(0, 120)}...
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
