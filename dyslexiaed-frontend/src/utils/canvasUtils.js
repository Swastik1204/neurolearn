/**
 * Canvas utility functions for the WritingCanvas component.
 */

/**
 * Draw a ruled-paper baseline grid on the canvas.
 * Shows top, mid, and baseline guides.
 */
export function drawBaselineGrid(ctx, width, height) {
  const lineCount = 3;
  const topLine = height * 0.2;
  const midLine = height * 0.5;
  const baseLine = height * 0.8;

  ctx.save();
  ctx.strokeStyle = '#D4D3C8';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.globalAlpha = 0.6;

  // Top guideline
  ctx.beginPath();
  ctx.moveTo(0, topLine);
  ctx.lineTo(width, topLine);
  ctx.stroke();

  // Mid guideline (dotted, lighter)
  ctx.strokeStyle = '#E2E1D5';
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(0, midLine);
  ctx.lineTo(width, midLine);
  ctx.stroke();

  // Baseline (solid-ish, darker)
  ctx.strokeStyle = '#B8B6A8';
  ctx.setLineDash([10, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, baseLine);
  ctx.lineTo(width, baseLine);
  ctx.stroke();

  ctx.restore();
}

/**
 * Convert a canvas element to a PNG Blob.
 */
export async function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
  });
}

/**
 * Calculate stroke metadata from an array of stroke data.
 * A stroke is an array of { x, y, timestamp, pressure }.
 */
export function calculateStrokeMetadata(strokes) {
  if (!strokes.length) {
    return {
      pointCount: 0,
      avgSpeed: 0,
      totalDuration: 0,
      strokeCount: 0,
    };
  }

  let totalPoints = 0;
  let totalDistance = 0;
  let totalDuration = 0;

  strokes.forEach((stroke) => {
    totalPoints += stroke.length;
    if (stroke.length >= 2) {
      const start = stroke[0];
      const end = stroke[stroke.length - 1];
      totalDuration += end.timestamp - start.timestamp;

      for (let i = 1; i < stroke.length; i++) {
        const dx = stroke[i].x - stroke[i - 1].x;
        const dy = stroke[i].y - stroke[i - 1].y;
        totalDistance += Math.sqrt(dx * dx + dy * dy);
      }
    }
  });

  const avgSpeed = totalDuration > 0 ? totalDistance / totalDuration : 0;

  return {
    pointCount: totalPoints,
    avgSpeed: Math.round(avgSpeed * 1000) / 1000,
    totalDuration,
    strokeCount: strokes.length,
  };
}

/**
 * Get a smooth point for drawing (basic moving average).
 */
export function smoothPoint(points, index, window = 3) {
  const half = Math.floor(window / 2);
  let sumX = 0, sumY = 0, count = 0;

  for (let i = Math.max(0, index - half); i <= Math.min(points.length - 1, index + half); i++) {
    sumX += points[i].x;
    sumY += points[i].y;
    count++;
  }

  return { x: sumX / count, y: sumY / count };
}
