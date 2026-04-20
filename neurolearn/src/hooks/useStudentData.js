import { useState, useEffect } from 'react';
import { getStudentSummary } from '@/services/api';

export default function useStudentData(studentId) {
  const [data, setData] = useState({
    sessions: [],
    analysisResults: [],
    reports: [],
    handwritingSamples: [],
    summary: null,
    loading: true,
    error: null,
  });
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = () => setRefreshToken((token) => token + 1);

  useEffect(() => {
    if (!studentId) {
      setData({
        sessions: [],
        analysisResults: [],
        reports: [],
        handwritingSamples: [],
        summary: null,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await getStudentSummary(studentId);
        const summaryData = res.data || null;

        if (!cancelled) {
          setData({
            sessions: summaryData?.sessions || [],
            analysisResults: summaryData?.analysisResults || [],
            reports: summaryData?.reports || [],
            handwritingSamples: summaryData?.handwritingSamples || [],
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
  }, [studentId, refreshToken]);

  return { ...data, refresh };
}
