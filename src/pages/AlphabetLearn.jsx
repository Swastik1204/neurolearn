import { useState, useEffect, useRef } from "react";
import { FaCheck, FaRedo, FaInfo, FaExclamationTriangle } from "react-icons/fa";
import { useAppContext } from "../context/AppContext.jsx";
import { saveAlphabetSession, uploadAlphabetCSV } from "../firebase/db.js";
import { saveAlphabetSessionCSV } from "../utils/csvStorage.js";

const GRID_SIZE = 40;
const CELL_SIZE = 10;
const CANVAS_WIDTH = GRID_SIZE * CELL_SIZE; // 400px
const CANVAS_HEIGHT = GRID_SIZE * CELL_SIZE; // 400px
const TOLERANCE = 1; // ±1 cell tolerance

// Only A, B, C letters
const ALPHABET = ['A', 'B', 'C'];

function AlphabetCanvas({ letter, onStrokeComplete, onReset, onSubmit, userId }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [sessionData, setSessionData] = useState([]);
  const [startTime] = useState(Date.now());
  const [templateData, setTemplateData] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState(''); // 'success', 'warning', 'error'
  const strokeBuffer = useRef([]);

  // Analysis metrics
  const [metrics, setMetrics] = useState({
    alignmentScore: 0,
    directionScore: 0,
    coverageScore: 0,
    totalAccuracy: 0,
    totalTime: 0,
    strokeCount: 0,
  });

  // Auto-hide feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback('');
        setFeedbackType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load template data for the letter
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await fetch(`/template_paths/${letter}.json`);
        const data = await response.json();
        setTemplateData(data);
      } catch (error) {
        console.error('Failed to load template:', error);
        setTemplateData(null);
      }
    };

    loadTemplate();
  }, [letter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    // Set fixed canvas size for grid system
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#4f46e5";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    contextRef.current = context;

    // Draw grid and template
    drawGrid();
    if (templateData) {
      drawTemplate();
    }
  }, [templateData]);

  const drawGrid = () => {
    const context = contextRef.current;
    context.strokeStyle = "#f3f4f6"; // Light gray grid lines
    context.lineWidth = 0.5;

    // Vertical lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      context.beginPath();
      context.moveTo(i * CELL_SIZE, 0);
      context.lineTo(i * CELL_SIZE, CANVAS_HEIGHT);
      context.stroke();
    }

    // Horizontal lines
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
    context.strokeStyle = "#3b82f6"; // Blue for template
    context.lineWidth = 2;
    context.setLineDash([3, 3]); // Dotted line

    templateData.paths.forEach(path => {
      context.beginPath();
      path.points.forEach((point, index) => {
        const x = point[0] * CELL_SIZE + CELL_SIZE / 2;
        const y = point[1] * CELL_SIZE + CELL_SIZE / 2;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
    });

    context.setLineDash([]); // Reset to solid lines
  };

  const getGridCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    // Calculate the scaling factor between displayed size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Get coordinates relative to the displayed canvas
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;

    // Convert to actual canvas coordinates
    const x = displayX * scaleX;
    const y = displayY * scaleY;

    // Convert to grid coordinates
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

  // Check if point is near template path
  const isNearTemplate = (gridX, gridY) => {
    if (!templateData) return false;

    for (const path of templateData.paths) {
      for (const point of path.points) {
        const dx = Math.abs(point[0] - gridX);
        const dy = Math.abs(point[1] - gridY);
        if (dx <= TOLERANCE && dy <= TOLERANCE) {
          return true;
        }
      }
    }
    return false;
  };

  // Check direction of movement
  const checkDirection = (fromPoint, toPoint) => {
    if (!templateData) return true;

    const dx = toPoint.gridX - fromPoint.gridX;
    const dy = toPoint.gridY - fromPoint.gridY;

    // Find expected direction from template
    for (const path of templateData.paths) {
      for (let i = 1; i < path.points.length; i++) {
        const prev = path.points[i - 1];
        const curr = path.points[i];

        // Check if we're near the previous point
        const prevDx = Math.abs(prev[0] - fromPoint.gridX);
        const prevDy = Math.abs(prev[1] - fromPoint.gridY);

        if (prevDx <= TOLERANCE && prevDy <= TOLERANCE) {
          // Check if movement direction matches template
          const expectedDx = curr[0] - prev[0];
          const expectedDy = curr[1] - prev[1];

          // Allow some flexibility in direction
          const directionMatch = Math.abs(dx - expectedDx) <= 1 && Math.abs(dy - expectedDy) <= 1;
          return directionMatch;
        }
      }
    }
    return true; // Default to true if no specific direction found
  };

  const startDrawing = (event) => {
    const coords = getGridCoordinates(event);
    contextRef.current.beginPath();
    contextRef.current.moveTo(coords.x, coords.y);
    strokeBuffer.current = [{ ...coords, time: Date.now() }];
    setIsDrawing(true);

    // Clear previous feedback
    setFeedback('');
    setFeedbackType('');
  };

  const draw = (event) => {
    if (!isDrawing) return;

    const coords = getGridCoordinates(event);
    contextRef.current.lineTo(coords.x, coords.y);
    contextRef.current.stroke();
    strokeBuffer.current.push({ ...coords, time: Date.now() });

    // Real-time feedback
    const lastPoint = strokeBuffer.current[strokeBuffer.current.length - 2];
    if (lastPoint) {
      const directionCorrect = checkDirection(lastPoint, coords);
      const onPath = isNearTemplate(coords.gridX, coords.gridY);

      if (!onPath) {
        setFeedback('Stay closer to the blue guide.');
        setFeedbackType('warning');
      } else if (!directionCorrect) {
        setFeedback('Trace the line in the shown direction.');
        setFeedbackType('warning');
      } else {
        setFeedback('Good! Keep following the guide.');
        setFeedbackType('success');
      }
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;

    contextRef.current.closePath();
    setIsDrawing(false);
    const finishedStroke = strokeBuffer.current;
    setStrokes((prev) => [...prev, finishedStroke]);

    // Process stroke data
    const processedData = finishedStroke.map((point, index) => {
      const velocity = index > 0 ? calculateVelocity(finishedStroke[index - 1], point) : 0;
      const acceleration = index > 1 ?
        calculateAcceleration(
          calculateVelocity(finishedStroke[index - 2], finishedStroke[index - 1]),
          velocity,
          point.time - finishedStroke[index - 1].time
        ) : 0;

      return {
        session_id: `session_${startTime}`,
        user_id: userId || 'anonymous',
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

    let alignmentScore = 0;
    let directionScore = 0;
    let coverageScore = 0;

    // Calculate alignment (how close to template path)
    const totalPoints = data.length;
    let onPathPoints = 0;

    for (const point of data) {
      if (isNearTemplate(point.grid_x, point.grid_y)) {
        onPathPoints++;
      }
    }
    alignmentScore = onPathPoints / totalPoints;

    // Calculate direction accuracy
    let correctDirectionPoints = 0;
    for (let i = 1; i < data.length; i++) {
      if (checkDirection(data[i - 1], data[i])) {
        correctDirectionPoints++;
      }
    }
    directionScore = correctDirectionPoints / (data.length - 1);

    // Calculate coverage (how much of template was covered)
    const templatePoints = new Set();
    templateData.paths.forEach(path => {
      path.points.forEach(point => {
        templatePoints.add(`${point[0]},${point[1]}`);
      });
    });

    const coveredPoints = new Set();
    data.forEach(point => {
      coveredPoints.add(`${point.grid_x},${point.grid_y}`);
    });

    let coveredTemplatePoints = 0;
    for (const templatePoint of templatePoints) {
      // Check if any user point is near this template point
      const [tx, ty] = templatePoint.split(',').map(Number);
      for (const userPoint of data) {
        const dx = Math.abs(userPoint.grid_x - tx);
        const dy = Math.abs(userPoint.grid_y - ty);
        if (dx <= TOLERANCE && dy <= TOLERANCE) {
          coveredTemplatePoints++;
          break;
        }
      }
    }
    coverageScore = coveredTemplatePoints / templatePoints.size;

    // Combined accuracy score
    const totalAccuracy = (alignmentScore * 0.4 + directionScore * 0.3 + coverageScore * 0.3);

    const totalTime = (Date.now() - startTime) / 1000;
    const strokeCount = strokes.length + 1;

    setMetrics({
      alignmentScore,
      directionScore,
      coverageScore,
      totalAccuracy,
      totalTime,
      strokeCount,
    });
  };

  const handleReset = () => {
    const context = contextRef.current;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGrid();
    if (templateData) {
      drawTemplate();
    }
    setStrokes([]);
    setSessionData([]);
    setFeedback('');
    setFeedbackType('');
    setMetrics({
      alignmentScore: 0,
      directionScore: 0,
      coverageScore: 0,
      totalAccuracy: 0,
      totalTime: 0,
      strokeCount: 0,
    });
    onReset?.();
  };

  const handleSubmit = async () => {
    if (metrics.totalAccuracy < 0.6) return;

    try {
      // Generate CSV with grid coordinates
      const csvContent = [
        'session_id,user_id,letter,timestamp,x,y,grid_x,grid_y,velocity,acceleration',
        ...sessionData.map(row =>
          `${row.session_id},${row.user_id},${row.letter},${row.timestamp},${row.x},${row.y},${row.grid_x},${row.grid_y},${row.velocity},${row.acceleration}`
        )
      ].join('\n');

      // Save to local storage
      const sessionId = sessionData[0]?.session_id || `session_${Date.now()}`;
      saveAlphabetSessionCSV(csvContent, letter, sessionId);

      // Also download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alphabet_${letter}_${sessionId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Upload to Firebase
      const csvUrl = await uploadAlphabetCSV(userId || 'anonymous', letter, csvContent);

      // Save session data to Firestore
      await saveAlphabetSession({
        uid: userId || 'anonymous',
        letter,
        sessionId,
        alignmentScore: metrics.alignmentScore,
        directionScore: metrics.directionScore,
        coverageScore: metrics.coverageScore,
        totalAccuracy: metrics.totalAccuracy,
        totalTime: metrics.totalTime,
        csvUrl,
      });

      setFeedback('Great job! Session saved successfully.');
      setFeedbackType('success');

      onSubmit?.();
    } catch (error) {
      console.error('Failed to save session:', error);
      setFeedback('Failed to save session. Please try again.');
      setFeedbackType('error');
    }
  };

  const isTracingComplete = strokes.length > 0;
  const canSubmit = metrics.totalAccuracy >= 0.6;
  const canTryAgain = isTracingComplete; // Always allow trying again when tracing is complete

  return (
    <div className="flex flex-col h-full relative">
      {/* Pop-up Alert on Right Side */}
      {feedback && (
        <div className="fixed top-1/2 right-4 z-50 transform -translate-y-1/2">
          <div className={`alert shadow-lg max-w-sm ${
            feedbackType === 'success' ? 'alert-success' :
            feedbackType === 'warning' ? 'alert-warning' : 'alert-error'
          }`}>
            <div>
              <FaExclamationTriangle className="text-lg" />
              <span className="font-medium">{feedback}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative rounded-2xl border-4 border-dashed border-primary/40 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full rounded-2xl touch-none border border-gray-200"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={(event) => {
            event.preventDefault();
            startDrawing(event);
          }}
          onTouchMove={(event) => {
            event.preventDefault();
            draw(event);
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            endDrawing(event);
          }}
        />
      </div>

      <div className="mt-4 flex gap-4 justify-center">
        <button
          className={`btn btn-lg ${canSubmit ? 'btn-success' : 'btn-disabled'}`}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          <FaCheck className="mr-2" />
          Submit Practice
        </button>

        <button
          className={`btn btn-lg ${canTryAgain ? 'btn-warning' : 'btn-disabled'}`}
          onClick={handleReset}
          disabled={!canTryAgain}
        >
          <FaRedo className="mr-2" />
          Try Again
        </button>
      </div>

      <div className="mt-4 card bg-base-100 shadow-lg">
        <div className="card-body">
          <h3 className="card-title">
            <FaInfo className="mr-2" />
            Tracing Analysis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold">Alignment:</span>
              <span className={`ml-2 ${metrics.alignmentScore >= 0.7 ? 'text-success' : 'text-warning'}`}>
                {(metrics.alignmentScore * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="font-semibold">Direction:</span>
              <span className={`ml-2 ${metrics.directionScore >= 0.7 ? 'text-success' : 'text-warning'}`}>
                {(metrics.directionScore * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="font-semibold">Coverage:</span>
              <span className={`ml-2 ${metrics.coverageScore >= 0.7 ? 'text-success' : 'text-warning'}`}>
                {(metrics.coverageScore * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="font-semibold">Total Accuracy:</span>
              <span className={`ml-2 ${metrics.totalAccuracy >= 0.6 ? 'text-success' : 'text-warning'}`}>
                {(metrics.totalAccuracy * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="font-semibold">Time:</span>
              <span className="ml-2">{metrics.totalTime.toFixed(1)}s</span>
            </div>
            <div>
              <span className="font-semibold">Strokes:</span>
              <span className="ml-2">{metrics.strokeCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlphabetLearn() {
  const { state } = useAppContext();
  const [selectedLetter, setSelectedLetter] = useState('A');

  const handleLetterSelect = (letter) => {
    setSelectedLetter(letter);
  };

  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-80 bg-base-100 border-r border-base-300">
        <div className="p-4 border-b border-base-300">
          <h2 className="text-xl font-bold mb-4">Choose a Letter</h2>
          <p className="text-sm text-base-content/70 mb-4">
            Select a letter to practice tracing. Each letter has a dotted template to guide your writing.
          </p>
        </div>

        <div className="flex-1 p-4">
          <div className="grid grid-cols-3 gap-4 justify-items-center">
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                className={`btn btn-xl font-bold w-20 h-20 text-2xl ${
                  selectedLetter === letter
                    ? 'btn-primary'
                    : 'btn-outline'
                }`}
                onClick={() => handleLetterSelect(letter)}
              >
                {letter}
              </button>
            ))}
          </div>

          <div className="mt-8 card bg-base-200">
            <div className="card-body">
              <h3 className="card-title text-lg">How to Practice</h3>
              <ul className="text-sm space-y-2">
                <li>• Follow the dotted template carefully</li>
                <li>• Try to keep your strokes smooth and steady</li>
                <li>• Practice until you achieve 70%+ accuracy</li>
                <li>• Your progress is automatically saved</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className="drawer drawer-mobile lg:hidden">
        <input id="mobile-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex flex-col">
          {/* Header */}
          <div className="navbar bg-base-100 shadow-lg">
            <div className="navbar-start">
              <label htmlFor="mobile-drawer" className="btn btn-square btn-ghost drawer-button">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </label>
            </div>
            <div className="navbar-center">
              <h1 className="text-2xl font-bold">Practicing: {selectedLetter}</h1>
            </div>
            <div className="navbar-end">
              <div className="badge badge-primary badge-lg">
                {state.user?.displayName || 'Guest'}
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 p-6">
            <AlphabetCanvas
              letter={selectedLetter}
              userId={state.user?.uid}
              onStrokeComplete={() => {}}
              onReset={() => {}}
              onSubmit={() => {}}
            />
          </div>
        </div>

        <div className="drawer-side">
          <label htmlFor="mobile-drawer" className="drawer-overlay"></label>
          <div className="menu p-4 w-80 bg-base-100 text-base-content min-h-full">
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">Choose a Letter</h2>
              <p className="text-sm text-base-content/70 mb-4">
                Select a letter to practice tracing. Each letter has a dotted template to guide your writing.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 justify-items-center">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  className={`btn btn-xl font-bold w-20 h-20 text-2xl ${
                    selectedLetter === letter
                      ? 'btn-primary'
                      : 'btn-outline'
                  }`}
                  onClick={() => {
                    handleLetterSelect(letter);
                    // Close drawer after selection on mobile
                    document.getElementById('mobile-drawer').checked = false;
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>

            <div className="mt-8 card bg-base-200">
              <div className="card-body">
                <h3 className="card-title text-lg">How to Practice</h3>
                <ul className="text-sm space-y-2">
                  <li>• Follow the dotted template carefully</li>
                  <li>• Try to keep your strokes smooth and steady</li>
                  <li>• Practice until you achieve 70%+ accuracy</li>
                  <li>• Your progress is automatically saved</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Main Content */}
      <div className="hidden lg:flex lg:flex-col lg:flex-1">
        {/* Header */}
        <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-center">
            <h1 className="text-2xl font-bold">Practicing: {selectedLetter}</h1>
          </div>
          <div className="navbar-end">
            <div className="badge badge-primary badge-lg">
              {state.user?.displayName || 'Guest'}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-6">
          <AlphabetCanvas
            letter={selectedLetter}
            userId={state.user?.uid}
            onStrokeComplete={() => {}}
            onReset={() => {}}
            onSubmit={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

export default AlphabetLearn;