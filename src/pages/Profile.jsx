import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import ProgressDashboard from "../components/ProgressDashboard.jsx";
import { listEmotionLogs } from "../firebase/db.js";
import { useAppContext } from "../context/AppContext.jsx";

function Profile() {
  const {
    state: { user },
  } = useAppContext();

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchLogs() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      const data = await listEmotionLogs(user.uid);
      if (isMounted) {
        setLogs(data);
        setLoading(false);
      }
    }
    fetchLogs();
    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl bg-base-100 p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-slate-800">
          Family progress hub
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Track handwriting accuracy, emotional wellbeing, and AI adaptation
          history. Parent accounts can subscribe to weekly summaries powered by
          Firestore triggers.
        </p>
      </section>

      <ProgressDashboard />

      <section className="rounded-3xl bg-base-100 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-700">
          Recent emotion logs
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading from Firestore…</p>
        ) : logs.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {logs.map((log) => {
              const timestamp =
                log.createdAt?.seconds !== undefined
                  ? new Date(log.createdAt.seconds * 1000)
                  : new Date(log.createdAt || Date.now());
              return (
                <article
                  key={log.id}
                  className="rounded-2xl border border-indigo-100 bg-white p-4"
                >
                  <p className="text-sm font-semibold text-slate-700">
                    Confidence: {Math.round(log.confidence * 100)}%
                  </p>
                  <p className="text-xs text-slate-500">
                    Frustration: {Math.round(log.frustration * 100)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {timestamp.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {log.notes || "Keep up the great work!"}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No logs yet. Complete a drawing session to see insights here.
          </p>
        )}
      </section>
    </div>
  );
}

export default Profile;
