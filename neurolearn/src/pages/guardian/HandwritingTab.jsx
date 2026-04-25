import { useMemo, useState } from 'react';
import { deleteHandwritingExercise } from '@/services/api';
import useStudentData from '@/hooks/useStudentData';
import AnnotatedSampleModal from '@/components/handwriting/AnnotatedSampleModal';
import Disclaimer from '@/components/Disclaimer';

const normalizeLetter = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '?';
  return raw[0].toUpperCase();
};

const riskTone = {
  low: 'text-success bg-success/10 border-success/20',
  medium: 'text-warning bg-warning/10 border-warning/20',
  high: 'text-destructive bg-destructive/10 border-destructive/20',
};

const interpretationText = (analysisResult) => {
  const text = analysisResult?.geminiInterpretation || analysisResult?.gemini_interpretation || '';
  return text && String(text).trim() ? text : 'Analysis in progress...';
};

export default function HandwritingTab({ studentId }) {
  const { handwritingSamples: samples = [], analysisResults = [], loading, refresh } = useStudentData(studentId);
  const [selectedSample, setSelectedSample] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const groupedSamples = useMemo(() => {
    return samples.reduce((acc, sample) => {
      const letter = normalizeLetter(sample.letter || sample.promptLetter || sample.analysisResult?.letter);
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(sample);
      return acc;
    }, {});
  }, [samples]);

  const handleSampleClick = (sample) => {
    setSelectedSample(sample);
    setAnalysisResult(sample.analysisResult || analysisResults.find((result) => result.sampleId === sample.id) || null);
  };

  const handleRetryAnalysis = async () => {
    await refresh();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteHandwritingExercise(deleteTarget.id);
      if (selectedSample?.id === deleteTarget.id) {
        setSelectedSample(null);
        setAnalysisResult(null);
      }
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      console.error('Delete exercise failed:', err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (samples.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No handwriting samples yet.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {Object.entries(groupedSamples)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([letter, letterSamples]) => (
          <div key={letter} className="card bg-base-100 border border-border shadow-sm">
            <div className="card-body">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">Letter {letter}</h3>
                <span className="text-xs text-muted-foreground">{letterSamples.length} sample{letterSamples.length === 1 ? '' : 's'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {letterSamples.map((sample) => {
                  const localResult = sample.analysisResult || analysisResults.find((item) => item.sampleId === sample.id) || {};
                  const riskLevel = String(localResult.riskLevel || localResult.risk_level || sample.analysisStatus || 'pending').toLowerCase();
                  const tones = riskTone[riskLevel] || 'text-muted-foreground bg-muted border-border';
                  const parseDate = (val) => {
                    if (!val) return null;
                    if (typeof val.toDate === 'function') return val.toDate();
                    if (val._seconds !== undefined) return new Date(val._seconds * 1000);
                    if (val.seconds !== undefined) return new Date(val.seconds * 1000);
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? null : d;
                  };
                  const dateObj = parseDate(sample.capturedAt);
                  const capturedAt = dateObj ? dateObj.toLocaleString() : 'Unknown date';
                  const scores = localResult.scores || {};

                  return (
                    <div key={sample.id} className="rounded-xl border border-border p-3 bg-base-100">
                      <button
                        type="button"
                        onClick={() => handleSampleClick(sample)}
                        className="w-full text-left"
                      >
                        <div className="aspect-[3/1] rounded-lg bg-[#FAFAF7] border border-border overflow-hidden mb-3">
                          <img
                            src={sample.imageBase64 || sample.imageUrl}
                            alt={`Sample ${letter}`}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${tones}`}>
                            {riskLevel === 'pending' ? 'Pending' : riskLevel.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">{capturedAt}</span>
                        </div>

                        <p className="text-xs text-muted-foreground italic line-clamp-3 mb-2">
                          {interpretationText(localResult)}
                        </p>

                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <span>Form: {Math.round(Number(scores.letterFormScore || 0))}</span>
                          <span>Spacing: {Math.round(Number(scores.spacingScore || 0))}</span>
                          <span>Baseline: {Math.round(Number(scores.baselineScore || 0))}</span>
                          <span>Reversal: {Math.round(Number(scores.reversalScore || 0))}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(sample)}
                        className="btn btn-xs btn-error btn-outline mt-3"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

      {selectedSample && (
        <AnnotatedSampleModal
          sample={selectedSample}
          analysisResult={analysisResult}
          onClose={() => {
            setSelectedSample(null);
            setAnalysisResult(null);
          }}
          onRetry={handleRetryAnalysis}
        />
      )}

      {deleteTarget && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete Exercise?</h3>
            <p className="py-3 text-sm text-muted-foreground">
              This will delete the sample and its analysis for "{deleteTarget.promptLetter || deleteTarget.letter || 'exercise'}".
            </p>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                No
              </button>
              <button type="button" className="btn btn-error" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-label="Close"
          />
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
