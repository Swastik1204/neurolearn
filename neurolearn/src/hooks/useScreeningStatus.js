import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

function parseDateLike(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value._seconds !== undefined) return new Date(value._seconds * 1000);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function useScreeningStatus(uid) {
  const [completed, setCompleted] = useState(false);
  const [needsRetest, setNeedsRetest] = useState(false);
  const [nextScreeningDueAt, setNextScreeningDueAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      if (!uid) {
        if (!cancelled) {
          setCompleted(false);
          setNeedsRetest(false);
          setNextScreeningDueAt(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const snap = await getDoc(doc(db, 'users', uid));
        const data = snap.exists() ? (snap.data() || {}) : {};
        const dueRaw =
          data?.nextScreeningDueAt
          || data?.screeningSchedule?.nextDueAt
          || data?.baselineProfile?.nextScreeningDueAt;
        const dueDate = parseDateLike(dueRaw);
        const retestDue = Boolean(dueDate && dueDate.getTime() <= Date.now());
        const status = data?.screeningCompleted === true && !retestDue;

        if (!cancelled) {
          setCompleted(Boolean(status));
          setNeedsRetest(retestDue);
          setNextScreeningDueAt(dueDate);
          setLoading(false);
        }
      } catch (error) {
        console.error('useScreeningStatus error:', error.message);
        if (!cancelled) {
          setCompleted(false);
          setNeedsRetest(false);
          setNextScreeningDueAt(null);
          setLoading(false);
        }
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { completed, needsRetest, nextScreeningDueAt, loading };
}
