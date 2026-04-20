import { useState } from 'react';
import ReportCard from '@/components/dashboard/ReportCard';
import useStudentData from '@/hooks/useStudentData';

export default function ReportTab({ studentId, studentName }) {
  const { reports = [], analysisResults = [], loading } = useStudentData(studentId);
  const [generatedReports, setGeneratedReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);

  const visibleReports = [...generatedReports, ...reports];
  const currentReport = visibleReports.find((report) => report.id === selectedReportId) || visibleReports[0] || null;

  const handleReportGenerated = (newReport) => {
    if (!newReport) return;
    setGeneratedReports((prev) => [newReport, ...prev.filter((report) => report.id !== newReport.id)]);
    setSelectedReportId(newReport.id);
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
        analysisResultsCount={analysisResults.length}
      />

      {/* Past Reports */}
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
