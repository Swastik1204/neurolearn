import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getStudentSummary } from '@/services/api';

export default function useStudentData(studentId) {
  const [data, setData] = useState({
    sessions: [],
    analysisResults: [],
    behaviourSnapshots: [],
    summary: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!studentId) {
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        // Fetch from API for aggregated data
        let summaryData = null;
        try {
          const res = await getStudentSummary(studentId);
          summaryData = res.data;
        } catch (apiError) {
          console.error('API summary unavailable, falling back to Firestore:', apiError.message);
        }

        // Fetch recent sessions from Firestore
        const sessionsQuery = query(
          collection(db, 'sessions'),
          where('studentId', '==', studentId),
          orderBy('startedAt', 'desc'),
          limit(20)
        );
        const sessionsSnap = await getDocs(sessionsQuery);
        const sessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fetch analysis results
        const analysisQuery = query(
          collection(db, 'analysisResults'),
          where('studentId', '==', studentId),
          orderBy('analyzedAt', 'desc'),
          limit(10)
        );
        const analysisSnap = await getDocs(analysisQuery);
        const analysisResults = analysisSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fetch behaviour snapshots
        const behavQuery = query(
          collection(db, 'behaviourSnapshots'),
          where('studentId', '==', studentId),
          orderBy('weekStartDate', 'desc'),
          limit(4)
        );
        const behavSnap = await getDocs(behavQuery);
        const behaviourSnapshots = behavSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!cancelled) {
          setData({
            sessions,
            analysisResults,
            behaviourSnapshots,
            summary: summaryData,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setData((prev) => ({
            ...prev,
            loading: false,
            error: error.message,
          }));
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [studentId]);

  return data;
}
