import { useRef, useEffect, useState, useCallback } from 'react';
import { drawBaselineGrid, canvasToBlob, calculateStrokeMetadata, smoothPoint } from '@/utils/canvasUtils';
import CanvasToolbar from './CanvasToolbar';

const DEFAULT_CANVAS_SIZE = 480;

export default function WritingCanvas({ prompt, onSubmit, disabled = false }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]); // Array of strokes, each stroke is array of points
  const [currentStroke, setCurrentStroke] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draw the current state to the canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.fillStyle = '#FAFAF7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw guidelines
    drawBaselineGrid(ctx, canvas.width, canvas.height);

    // Draw all completed strokes
    const allStrokes = [...strokes, ...(currentStroke.length > 0 ? [currentStroke] : [])];
    allStrokes.forEach((stroke) => {
      if (stroke.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = '#1A1A2E';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const first = smoothPoint(stroke, 0);
      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < stroke.length; i++) {
        const pt = smoothPoint(stroke, i);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    });
  }, [strokes, currentStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set internal resolution once on mount
    const size = Math.min(window.innerWidth * 0.85, DEFAULT_CANVAS_SIZE);
    canvas.width = size;
    canvas.height = size;
    redraw();
  }, [redraw]);

  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      timestamp: Date.now(),
      pressure: e.pressure || 0.5,
    };
  };

  const handlePointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const point = getPointerPos(e);
    setCurrentStroke([point]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const point = getPointerPos(e);
    setCurrentStroke((prev) => [...prev, point]);
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async (submitMeta = {}) => {
    // CRITICAL: Don't submit if no strokes exist
    if (strokes.length === 0 || isSubmitting) {
      console.warn('Submission blocked: no strokes on canvas', { strokesCount: strokes.length, isSubmitting });
      return;
    }
    setIsSubmitting(true);

    try {
      const canvas = canvasRef.current;
      const blob = await canvasToBlob(canvas);
      const metadata = calculateStrokeMetadata(strokes);

      await onSubmit({
        imageBlob: blob,
        strokeData: strokes,
        strokeMetadata: metadata,
        submitMeta,
      });

      // Clear after successful submit
      handleClear();
    } catch (error) {
      console.error('Submit failed:', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <div
        className="relative rounded-xl border-2 border-border overflow-hidden shadow-inner bg-[#FAFAF7] cursor-crosshair"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full mx-auto block"
          style={{ 
            aspectRatio: '1/1',
            maxWidth: `${DEFAULT_CANVAS_SIZE}px`
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          aria-label={`Writing canvas for: ${prompt}`}
          role="img"
        />
        
        {/* Empty canvas hint */}
        {strokes.length === 0 && currentStroke.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground/60">Start drawing here</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Trace the letter above</p>
            </div>
          </div>
        )}
      </div>

      <CanvasToolbar
        onClear={handleClear}
        onUndo={handleUndo}
        onSubmit={handleSubmit}
        canUndo={strokes.length > 0}
        canSubmit={strokes.length > 0}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
