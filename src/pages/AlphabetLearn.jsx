import { useState, useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { saveAlphabetSession, uploadAlphabetCSV } from "../firebase/db.js";
import { saveAlphabetSessionCSV } from "../utils/csvStorage.js";

const GRID_SIZE = 40;
const CELL_SIZE = 10;
const CANVAS_WIDTH = GRID_SIZE * CELL_SIZE;
const CANVAS_HEIGHT = GRID_SIZE * CELL_SIZE;
const TOLERANCE = 1;

const ALPHABET = ["A", "B", "C"];

function AlphabetCanvas({ letter, onStrokeComplete, onReset, onSubmit, userId }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [sessionData, setSessionData] = useState([]);
  const [startTime] = useState(Date.now());
  const [templateData, setTemplateData] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const strokeBuffer = useRef([]);

  const [metrics, setMetrics] = useState({
    alignmentScore: 0,
    directionScore: 0,
    coverageScore: 0,
    totalAccuracy: 0,
    totalTime: 0,
    strokeCount: 0,
  });

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback("");
        setFeedbackType("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await fetch(`/template_paths/${letter}.json`);
        const data = await response.json();
        setTemplateData(data);
      } catch (error) {
        console.error("Failed to load template:", error);
        setTemplateData(null);
      }
    };
    loadTemplate();
  }, [letter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#6366f1";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    contextRef.current = context;
    drawGrid();
    if (templateData) drawTemplate();
  }, [templateData]);

  const drawGrid = () => {
    const context = contextRef.current;
    context.strokeStyle = "#f3f4f6";
    context.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      context.beginPath();
      context.moveTo(i * CELL_SIZE, 0);
      context.lineTo(i * CELL_SIZE, CANVAS_HEIGHT);
      context.stroke();
    }
    for (let i = 0; i <= GRID_SIZE; i++) {
      context.beginPath();
      context.moveTo(0, i * CELL_SIZE);
      context.lineTo(CANVAS_WIDTH, i * CELL_SIZE);
      context.stroke();
    }
  };

  const drawTemplate = () => {
    if (!templateData) return;
    const context = contextRef.current;
    context.strokeStyle = "#818cf8";
    context.lineWidth = 2;
    context.setLineDash([3, 3]);
    templateData.paths.forEach((path) => {
      context.beginPath();
      path.points.forEach((point, index) => {
        const x = point[0] * CELL_SIZE + CELL_SIZE / 2;
        const y = point[1] * CELL_SIZE + CELL_SIZE / 2;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    });
    context.setLineDash([]);
  };

  const getGridCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;
    const x = displayX * scaleX;
    const y = displayY * scaleY;
    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    return { x, y, gridX, gridY };
  };

  const calculateVelocity = (point1, point2) => {
    const distance = Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
    const timeDiff = point2.time - point1.time;
    return timeDiff > 0 ? distance / timeDiff : 0;
  };

  const calculateAcceleration = (vel1, vel2, timeDiff) => {
    return timeDiff > 0 ? (vel2 - vel1) / timeDiff : 0;
  };

  const isNearTemplate = (gridX, gridY) => {
    if (!templateData) return false;
    for (const path of templateData.paths) {
      for (const point of path.points) {
        const dx = Math.abs(point[0] - gridX);
        const dy = Math.abs(point[1] - gridY);
        if (dx <= TOLERANCE && dy <= TOLERANCE) return true;
      }
    }
    return false;
  };

  const checkDirection = (fromPoint, toPoint) => {
    if (!templateData) return true;
    const dx = toPoint.gridX - fromPoint.gridX;
    const dy = toPoint.gridY - fromPoint.gridY;
    for (const path of templateData.paths) {
      for (let i = 1; i < path.points.length; i++) {
        const prev = path.points[i - 1];
        const curr = path.points[i];
        const prevDx = Math.abs(prev[0] - fromPoint.gridX);
        const prevDy = Math.abs(prev[1] - fromPoint.gridY);
        if (prevDx <= TOLERANCE && prevDy <= TOLERANCE) {
          const expectedDx = curr[0] - prev[0];
          const expectedDy = curr[1] - prev[1];
          return Math.abs(dx - expectedDx) <= 1 && Math.abs(dy - expectedDy) <= 1;
        }
      }
    }
    return true;
  };

  const startDrawing = (event) => {
    const coords = getGridCoordinates(event);
    contextRef.current.beginPath();
    contextRef.current.moveTo(coords.x, coords.y);
    strokeBuffer.current = [{ ...coords, time: Date.now() }];
    setIsDrawing(true);
    setFeedback("");
    setFeedbackType("");
  };

  const draw = (event) => {
    if (!isDrawing) return;
    const coords = getGridCoordinates(event);
    contextRef.current.lineTo(coords.x, coords.y);
    contextRef.current.stroke();
    strokeBuffer.current.push({ ...coords, time: Date.now() });
    const lastPoint = strokeBuffer.current[strokeBuffer.current.length - 2];
    if (lastPoint) {
      const directionCorrect = checkDirection(lastPoint, coords);
      const onPath = isNearTemplate(coords.gridX, coords.gridY);
      if (!onPath) { setFeedback("Stay closer to the blue guide."); setFeedbackType("warning"); }
      else if (!directionCorrect) { setFeedback("Trace the line in the shown direction."); setFeedbackType("warning"); }
      else { setFeedback("Good! Keep following the guide."); setFeedbackType("success"); }
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
    const finishedStroke = strokeBuffer.current;
    setStrokes((prev) => [...prev, finishedStroke]);
    const processedData = finishedStroke.map((point, index) => {
      const velocity = index > 0 ? calculateVelocity(finishedStroke[index - 1], point) : 0;
      const acceleration = index > 1
        ? calculateAcceleration(
            calculateVelocity(finishedStroke[index - 2], finishedStroke[index - 1]),
            velocity,
            point.time - finishedStroke[index - 1].time
          )
        : 0;
      return {
        session_id: `session_${startTime}`,
        user_id: userId || "anonymous",
        letter,
        timestamp: point.time,
        x: point.x,
        y: point.y,
        grid_x: point.gridX,
        grid_y: point.gridY,
        velocity,
        acceleration,
      };
    });
    setSessionData((prev) => [...prev, ...processedData]);
    analyzePerformance([...sessionData, ...processedData]);
    onStrokeComplete?.(finishedStroke);
    strokeBuffer.current = [];
  };

  const analyzePerformance = (data) => {
    if (data.length < 2 || !templateData) return;
    let alignmentScore = 0, directionScore = 0, coverageScore = 0;
    const totalPoints = data.length;
    let onPathPoints = 0;
    for (const point of data) {
      if (isNearTemplate(point.grid_x, point.grid_y)) onPathPoints++;
    }
    alignmentScore = onPathPoints / totalPoints;
    let correctDirectionPoints = 0;
    for (let i = 1; i < data.length; i++) {
      if (checkDirection(data[i - 1], data[i])) correctDirectionPoints++;
    }
    directionScore = correctDirectionPoints / (data.length - 1);
    const templatePoints = new Set();
    templateData.paths.forEach((path) => {
      path.points.forEach((point) => templatePoints.add(`${point[0]},${point[1]}`));
    });
    let coveredTemplatePoints = 0;
    for (const templatePoint of templatePoints) {
      const [tx, ty] = templatePoint.split(",").map(Number);
      for (const userPoint of data) {
        if (Math.abs(userPoint.grid_x - tx) <= TOLERANCE && Math.abs(userPoint.grid_y - ty) <= TOLERANCE) {
          coveredTemplatePoints++;
          break;
        }
      }
    }
    coverageScore = coveredTemplatePoints / templatePoints.size;
    const totalAccuracy = alignmentScore * 0.4 + directionScore * 0.3 + coverageScore * 0.3;
    const totalTime = (Date.now() - startTime) / 1000;
    const strokeCount = strokes.length + 1;
    setMetrics({ alignmentScore, directionScore, coverageScore, totalAccuracy, totalTime, strokeCount });
  };

  const handleReset = () => {
    const context = contextRef.current;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGrid();
    if (templateData) drawTemplate();
    setStrokes([]);
    setSessionData([]);
    setFeedback("");
    setFeedbackType("");
    setMetrics({ alignmentScore: 0, directionScore: 0, coverageScore: 0, totalAccuracy: 0, totalTime: 0, strokeCount: 0 });
    onReset?.();
  };

  const handleSubmit = async () => {
    if (metrics.totalAccuracy < 0.6) return;
    try {
      const csvContent = [
        "session_id,user_id,letter,timestamp,x,y,grid_x,grid_y,velocity,acceleration",
        ...sessionData.map(
          (row) =>
            `${row.session_id},${row.user_id},${row.letter},${row.timestamp},${row.x},${row.y},${row.grid_x},${row.grid_y},${row.velocity},${row.acceleration}`
        ),
      ].join("\n");
      const sessionId = sessionData[0]?.session_id || `session_${Date.now()}`;
      saveAlphabetSessionCSV(csvContent, letter, sessionId);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alphabet_${letter}_${sessionId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const csvUrl = await uploadAlphabetCSV(userId || "anonymous", letter, csvContent);
      await saveAlphabetSession({
        uid: userId || "anonymous",
        letter,
        sessionId,
        alignmentScore: metrics.alignmentScore,
        directionScore: metrics.directionScore,
        coverageScore: metrics.coverageScore,
        totalAccuracy: metrics.totalAccuracy,
        totalTime: metrics.totalTime,
        csvUrl,
      });
      setFeedback("Great job! Session saved successfully.");
      setFeedbackType("success");
      onSubmit?.();
    } catch (error) {
      console.error("Failed to save session:", error);
      setFeedback("Failed to save session. Please try again.");
      setFeedbackType("error");
    }
  };

  const isTracingComplete = strokes.length > 0;
  const canSubmit = metrics.totalAccuracy >= 0.6;

  const feedbackColors = {
    success: "from-green-400/20 to-emerald-400/20 border-green-300/50 text-green-700",
    warning: "from-amber-400/20 to-yellow-400/20 border-amber-300/50 text-amber-700",
    error: "from-red-400/20 to-pink-400/20 border-red-300/50 text-red-700",
  };

  return (
    <div className="flex flex-col h-full relative gap-6">
      {/* Floating feedback toast */}
      {feedback && (
        <div className="fixed top-32 right-6 z-50 animate-[fadeIn_0.3s_ease-out]">
          <div
            className={`px-5 py-3 rounded-2xl backdrop-blur-xl border shadow-glass-card bg-gradient-to-r ${
              feedbackColors[feedbackType] || feedbackColors.warning
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-lg">
                {feedbackType === "success" ? "check_circle" : feedbackType === "error" ? "error" : "warning"}
              </span>
              <span className="font-medium text-sm">{feedback}</span>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="glass-panel rounded-3xl p-4 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full rounded-2xl touch-none border-2 border-dashed border-[#6366f1]/30 bg-white"
          style={{ aspectRatio: "1 / 1", maxHeight: "400px" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
          onTouchMove={(e) => { e.preventDefault(); draw(e); }}
          onTouchEnd={(e) => { e.preventDefault(); endDrawing(e); }}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 justify-center">
        <button
          className={`px-8 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all duration-300 ${
            canSubmit
              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:-translate-y-0.5"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          <span className="material-symbols-rounded text-lg">check_circle</span>
          Submit Practice
        </button>
        <button
          className={`px-8 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all duration-300 ${
            isTracingComplete
              ? "bg-white/50 border border-white/40 backdrop-blur-md text-slate-700 hover:bg-white/70 shadow-sm"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
          onClick={handleReset}
          disabled={!isTracingComplete}
        >
          <span className="material-symbols-rounded text-lg">refresh</span>
          Try Again
        </button>
      </div>

      {/* Metrics card */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-rounded text-xl">analytics</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Tracing Analysis</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Alignment", value: metrics.alignmentScore, color: "text-[#6366f1]" },
            { label: "Direction", value: metrics.directionScore, color: "text-[#8b5cf6]" },
            { label: "Coverage", value: metrics.coverageScore, color: "text-[#f472b6]" },
            { label: "Total Accuracy", value: metrics.totalAccuracy, color: "text-emerald-500" },
            { label: "Time", value: null, display: `${metrics.totalTime.toFixed(1)}s`, color: "text-cyan-500" },
            { label: "Strokes", value: null, display: metrics.strokeCount, color: "text-amber-500" },
          ].map((metric) => (
            <div
              key={metric.label}
              className="bg-white/40 backdrop-blur-sm rounded-xl p-3 border border-white/40"
            >
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {metric.label}
              </p>
              <p className={`text-xl font-bold ${metric.color}`}>
                {metric.value !== null
                  ? `${(metric.value * 100).toFixed(1)}%`
                  : metric.display}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlphabetLearn() {
  const { state } = useAppContext();
  const [selectedLetter, setSelectedLetter] = useState("A");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* ── Sidebar: Letter Picker ── */}
      <div className="lg:col-span-4">
        <div className="glass-panel rounded-3xl p-8 sticky top-28 border border-white/60">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#f472b6] flex items-center justify-center text-white shadow-glow">
              <span className="material-symbols-rounded text-2xl">abc</span>
            </div>
            <div>
              <span className="text-xs font-bold text-[#6366f1] uppercase tracking-widest">
                Alphabet Lab
              </span>
              <h2 className="text-xl font-bold text-slate-800">Choose a Letter</h2>
            </div>
          </div>

          {/* Letter buttons */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                className={`w-full aspect-square rounded-2xl text-2xl font-bold transition-all duration-300 flex items-center justify-center ${
                  selectedLetter === letter
                    ? "bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white shadow-lg shadow-[#6366f1]/30 scale-105"
                    : "bg-white/50 text-slate-600 border border-white/40 hover:bg-white/70 hover:scale-105"
                }`}
                onClick={() => setSelectedLetter(letter)}
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Instructions card */}
          <div className="bg-white/40 p-5 rounded-2xl backdrop-blur-md border border-white/40 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-rounded text-[#6366f1] text-lg">help</span>
              How to Practice
            </h3>
            <ul className="space-y-3">
              {[
                { icon: "gesture", text: "Follow the dotted template carefully" },
                { icon: "speed", text: "Keep your strokes smooth and steady" },
                { icon: "trending_up", text: "Practice until you achieve 70%+ accuracy" },
                { icon: "cloud_done", text: "Your progress is automatically saved" },
              ].map((item) => (
                <li key={item.icon} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#6366f1]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-rounded text-[#6366f1] text-sm">
                      {item.icon}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* User badge */}
          <div className="mt-6 flex items-center gap-3 px-4 py-3 bg-white/30 rounded-xl border border-white/30">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-[#6366f1] text-white flex items-center justify-center text-xs font-bold">
              {(state.user?.displayName || "G").charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-slate-700">
              {state.user?.displayName || "Guest"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Content: Canvas Area ── */}
      <div className="lg:col-span-8 space-y-6">
        {/* Title bar */}
        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30 text-3xl font-bold">
              {selectedLetter}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                Practicing: {selectedLetter}
              </h2>
              <p className="text-slate-500 font-medium">
                Trace the dotted template to practice your handwriting
              </p>
            </div>
          </div>
        </div>

        {/* Canvas + metrics */}
        <AlphabetCanvas
          letter={selectedLetter}
          userId={state.user?.uid}
          onStrokeComplete={() => {}}
          onReset={() => {}}
          onSubmit={() => {}}
        />
      </div>
    </div>
  );
}

export default AlphabetLearn;