import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import SampleGrid from '@/components/handwriting/SampleGrid';
import AnnotatedSampleModal from '@/components/handwriting/AnnotatedSampleModal';

export default function HandwritingTab({ studentId }) {
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(true);

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

    // Fetch analysis result for this sample
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
      <SampleGrid samples={samples} onSampleClick={handleSampleClick} />

      {selectedSample && (
        <AnnotatedSampleModal
          sample={selectedSample}
          analysisResult={analysisResult}
          onClose={() => { setSelectedSample(null); setAnalysisResult(null); }}
        />
      )}
    </div>
  );
}
