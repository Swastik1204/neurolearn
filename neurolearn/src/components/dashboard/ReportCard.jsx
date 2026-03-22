import { useState } from 'react';
import { generateReport } from '@/services/api';
import { downloadReportPDF } from '@/utils/pdfExport';
import { FileText, Download, RefreshCw, Calendar } from 'lucide-react';
import { formatDate } from '@/utils/dateUtils';

export default function ReportCard({ report, studentName, studentId, onReportGenerated }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday

      const res = await generateReport({
        studentId,
        weekStartDate: weekStart.toISOString().split('T')[0],
      });

      if (onReportGenerated) onReportGenerated(res.data);
    } catch (err) {
      setError('Could not generate report. Please try again later.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    downloadReportPDF({
      studentName,
      weekLabel: report.weekStartDate ? `Week of ${formatDate(report.weekStartDate)}` : 'This Week',
      narrative: report.narrativeSummary,
      highlights: report.handwritingHighlights,
      activities: report.recommendedActivities,
    });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {report ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Weekly Report</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {report.weekStartDate ? formatDate(report.weekStartDate) : 'This Week'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-all"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>

          <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {report.narrativeSummary}
          </div>

          {report.recommendedActivities?.length > 0 && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-sm text-foreground mb-3">📌 Recommended Activities</h4>
              <ul className="space-y-2">
                {report.recommendedActivities.map((activity, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">
                      {i + 1}
                    </span>
                    {activity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">No report yet this week</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Generate a weekly progress report powered by AI
          </p>

          {error && (
            <p className="text-sm text-destructive mb-4">{error}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Generate This Week's Report
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
