import { useEffect, useRef, useState } from "react";
import { FaEraser, FaSave } from "react-icons/fa";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;

function CanvasPad({ onStrokeComplete, onSaveDrawing }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const strokeBuffer = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 12;
    context.strokeStyle = "#4f46e5";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    contextRef.current = context;
  }, []);

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (event) => {
    const { x, y } = getCanvasCoordinates(event);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    strokeBuffer.current = [{ x, y, time: Date.now() }];
    setIsDrawing(true);
  };

  const draw = (event) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoordinates(event);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    strokeBuffer.current.push({ x, y, time: Date.now() });
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
    const finishedStroke = strokeBuffer.current;
    setStrokes((prev) => [...prev, finishedStroke]);

    // Emit stroke metadata so TensorFlow.js can score the letter shape.
    onStrokeComplete?.(finishedStroke);
    strokeBuffer.current = [];
  };

  const handleClear = () => {
    const context = contextRef.current;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setStrokes([]);
  };

  const handleSave = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSaveDrawing?.({ dataUrl, strokes });
  };

  return (
    <div className="rounded-3xl bg-base-100 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-700">
            Alphabet Practice
          </h3>
          <p className="text-sm text-slate-500">
            Draw the letter exactly how you feel. We will keep practicing until
            it feels right.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleClear}
          >
            <FaEraser />
            Clear
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
          >
            <FaSave />
            Save
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl border-4 border-dashed border-primary/40 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full rounded-2xl"
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
    </div>
  );
}

export default CanvasPad;
