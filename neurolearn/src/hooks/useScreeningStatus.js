import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export default function useScreeningStatus(uid) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      if (!uid) {
        if (!cancelled) {
          setCompleted(false);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const snap = await getDoc(doc(db, 'users', uid));
        const status = snap.exists() && snap.data()?.screeningCompleted === true;
        if (!cancelled) {
          setCompleted(Boolean(status));
          setLoading(false);
        }
      } catch (error) {
        console.error('useScreeningStatus error:', error.message);
        if (!cancelled) {
          setCompleted(false);
          setLoading(false);
        }
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { completed, loading };
}
