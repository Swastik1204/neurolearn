import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import SampleGrid from '@/components/handwriting/SampleGrid';
import AnnotatedSampleModal from '@/components/handwriting/AnnotatedSampleModal';
import { deleteHandwritingExercise } from '@/services/api';

export default function HandwritingTab({ studentId }) {
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    const fetch = async () => {
      try {
        const q = query(
          collection(db, 'handwritingSamples'),
          where('studentId', '==', studentId),
          orderBy('capturedAt', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setSamples(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading samples:', err.message);
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [studentId]);

  const handleSampleClick = async (sample) => {
    setSelectedSample(sample);
    setAnalysisResult(null);

    // Try to fetch analysis result if it's complete
    if (sample.analysisStatus === 'complete') {
      try {
        const q = query(
          collection(db, 'analysisResults'),
          where('sampleId', '==', sample.id),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.docs.length > 0) {
          setAnalysisResult(snap.docs[0].data());
        }
      } catch (err) {
        console.error('Error loading analysis:', err.message);
      }
    } else if (sample.analysisStatus === 'processing') {
      // Poll for analysis result if still processing
      const maxRetries = 5;
      let retries = 0;
      const pollInterval = setInterval(async () => {
        if (retries >= maxRetries) {
          clearInterval(pollInterval);
          return;
        }
        try {
          const q = query(
            collection(db, 'analysisResults'),
            where('sampleId', '==', sample.id),
            limit(1)
          );
          const snap = await getDocs(q);
          if (snap.docs.length > 0) {
            setAnalysisResult(snap.docs[0].data());
            clearInterval(pollInterval);
          }
          retries++;
        } catch (err) {
          console.error('Error polling analysis:', err.message);
          retries++;
        }
      }, 2000);
    }
  };

  const handleRetryAnalysis = async () => {
    if (!selectedSample) return;
    try {
      const q = query(
        collection(db, 'analysisResults'),
        where('sampleId', '==', selectedSample.id),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.docs.length > 0) {
        setAnalysisResult(snap.docs[0].data());
      }
    } catch (err) {
      console.error('Error retrying analysis:', err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteHandwritingExercise(deleteTarget.id);
      setSamples((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      if (selectedSample?.id === deleteTarget.id) {
        setSelectedSample(null);
        setAnalysisResult(null);
      }
      setDeleteTarget(null);
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
              This will delete the sample and its analysis for "{deleteTarget.promptWord || 'exercise'}".
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
