import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';

export default function useAnalysisResults(studentId, maxResults = 10) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      try {
        const q = query(
          collection(db, 'analysisResults'),
          where('studentId', '==', studentId),
          orderBy('analyzedAt', 'desc'),
          limit(maxResults)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (!cancelled) {
          setResults(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [studentId, maxResults]);

  return { results, loading, error };
}
