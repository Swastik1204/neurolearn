import { useState, useEffect, useRef, useCallback } from "react";
import logger from "../debug/logger.js";
import { useAppContext } from "../context/AppContext.jsx";

const LEVEL_COLORS = {
  DEBUG: "text-gray-400",
  INFO: "text-info",
  WARN: "text-warning",
  ERROR: "text-error",
};

function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("logs"); // logs | state | env
  const [logs, setLogs] = useState(() => logger.getHistory());
  const [filter, setFilter] = useState("");
  const scrollRef = useRef(null);
  const { state } = useAppContext();

  // Toggle with Ctrl+D
  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Subscribe to new log entries
  useEffect(() => {
    return logger.subscribe(() => {
      setLogs(logger.getHistory());
    });
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current && activeTab === "logs") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  const clearLogs = useCallback(() => {
    // We can't truly clear the logger history, so just reset local state
    setLogs([]);
  }, []);

  if (!isOpen) return null;

  const filtered = filter
    ? logs.filter(
        (l) =>
          l.message.toLowerCase().includes(filter.toLowerCase()) ||
          l.module.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  const envInfo = {
    mode: import.meta.env.MODE,
    dev: String(import.meta.env.DEV),
    firebaseProject: import.meta.env.VITE_FIREBASE_PROJECT_ID || "(not set)",
    genAIProvider: import.meta.env.VITE_GENAI_PROVIDER || "(not set)",
    genAIKeySet: import.meta.env.VITE_GENAI_API_KEY ? "yes" : "no",
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Panel */}
      <div
        className="absolute bottom-0 right-0 w-full sm:w-[480px] max-h-[70vh] pointer-events-auto
                    bg-gray-900 text-gray-100 rounded-tl-xl shadow-2xl border-l border-t border-gray-700
                    flex flex-col font-mono text-xs"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-tl-xl border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold text-sm">🐛 Debug</span>
            <div className="flex gap-1">
              {["logs", "state", "env"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 py-0.5 rounded text-[11px] uppercase tracking-wide ${
                    activeTab === tab
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[10px]">Ctrl+D</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Logs Tab */}
          {activeTab === "logs" && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700">
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="flex-1 bg-gray-800 text-gray-200 px-2 py-1 rounded text-[11px] outline-none
                             border border-gray-600 focus:border-indigo-500"
                />
                <button
                  onClick={clearLogs}
                  className="text-[10px] text-gray-400 hover:text-white px-1"
                >
                  Clear
                </button>
                <span className="text-gray-500 text-[10px]">
                  {filtered.length}
                </span>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-1">
                {filtered.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No log entries yet.
                  </p>
                ) : (
                  filtered.map((entry, i) => (
                    <div
                      key={`${entry.ts}-${i}`}
                      className="flex gap-2 py-0.5 border-b border-gray-800 last:border-0"
                    >
                      <span className="text-gray-500 shrink-0 w-[72px]">
                        {new Date(entry.ts).toISOString().slice(11, 23)}
                      </span>
                      <span
                        className={`shrink-0 w-[42px] uppercase ${
                          LEVEL_COLORS[entry.level] || "text-gray-400"
                        }`}
                      >
                        {entry.level}
                      </span>
                      <span className="text-indigo-400 shrink-0">
                        [{entry.module}]
                      </span>
                      <span className="text-gray-200 break-all">
                        {entry.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* State Tab */}
          {activeTab === "state" && (
            <div className="flex-1 overflow-auto px-3 py-2">
              <pre className="whitespace-pre-wrap text-green-300">
                {JSON.stringify(state, null, 2)}
              </pre>
            </div>
          )}

          {/* Env Tab */}
          {activeTab === "env" && (
            <div className="flex-1 overflow-auto px-3 py-2">
              <table className="w-full text-[11px]">
                <tbody>
                  {Object.entries(envInfo).map(([key, val]) => (
                    <tr key={key} className="border-b border-gray-800">
                      <td className="py-1 pr-3 text-gray-400 font-semibold">
                        {key}
                      </td>
                      <td className="py-1 text-gray-200">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DebugPanel;
