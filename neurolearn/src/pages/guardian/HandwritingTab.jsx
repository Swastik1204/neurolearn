import { useState, useEffect } from 'react';
import SampleGrid from '@/components/handwriting/SampleGrid';
import AnnotatedSampleModal from '@/components/handwriting/AnnotatedSampleModal';
import { deleteHandwritingExercise } from '@/services/api';
import useStudentData from '@/hooks/useStudentData';

export default function HandwritingTab({ studentId }) {
  const { handwritingSamples: samples = [], analysisResults = [], loading, refresh } = useStudentData(studentId);
  const [selectedSample, setSelectedSample] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!samples.length) return;
    setSelectedSample((current) => {
      if (!current) return null;
      return samples.find((sample) => sample.id === current.id) || null;
    });
  }, [samples]);

  const handleSampleClick = async (sample) => {
    setSelectedSample(sample);
    setAnalysisResult(sample.analysisResult || analysisResults.find((result) => result.sampleId === sample.id) || null);
  };

  const handleRetryAnalysis = async () => {
    if (!selectedSample) return;
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
      refresh();
    } catch (err) {
      console.error('Delete exercise failed:', err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <SampleGrid
        samples={samples}
        onSampleClick={handleSampleClick}
        onDeleteClick={(sample) => setDeleteTarget(sample)}
      />

      {selectedSample && (
        <AnnotatedSampleModal
          sample={selectedSample}
          analysisResult={analysisResult}
          onClose={() => { setSelectedSample(null); setAnalysisResult(null); }}
          onRetry={handleRetryAnalysis}
        />
      )}

      {deleteTarget && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete Exercise?</h3>
            <p className="py-3 text-sm text-muted-foreground">
              This will delete the sample and its analysis for "{deleteTarget.promptLetter || 'exercise'}".
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                No
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
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
    </div>
  );
}
