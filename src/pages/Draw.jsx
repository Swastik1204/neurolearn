import { useState } from "react";
import CanvasPad from "../components/CanvasPad.jsx";
import EmotionVisualizer from "../components/EmotionVisualizer.jsx";
import { calculateAdaptation } from "../utils/reinforcement.js";
import { saveEmotionLog, saveDrawing } from "../firebase/db.js";
import { useAppContext } from "../context/AppContext.jsx";

function Draw() {
  const {
    state: { user, performance, emotionState },
    updateEmotion,
    updatePerformance,
  } = useAppContext();

  const [analysis, setAnalysis] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStrokeComplete = async (stroke) => {
    const adaptation = await calculateAdaptation({
      strokes: [stroke],
      performance,
      emotionState,
    });

    setAnalysis(adaptation);
    updateEmotion({
      confidence: adaptation.confidence,
      mood: adaptation.frustration > 0.6 ? "frustrated" : "focused",
    });
    updatePerformance({ accuracy: Math.min(adaptation.confidence + 0.1, 1) });

    if (user?.uid) {
      await saveEmotionLog(user.uid, {
        frustration: adaptation.frustration,
        confidence: adaptation.confidence,
        notes: adaptation.prompt,
      });
    }
  };

  const handleSaveDrawing = async ({ dataUrl, strokes }) => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      const path = await saveDrawing({
        userId: user.uid,
        dataUrl,
        metadata: { contentType: "image/png" },
      });
      console.info("[draw] saved to storage path", path);
      await saveEmotionLog(user.uid, {
        label: "drawing-upload",
        strokes: strokes.length,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr,2fr]">
      <div className="grid gap-4">
        <CanvasPad
          onStrokeComplete={handleStrokeComplete}
          onSaveDrawing={handleSaveDrawing}
        />
        {analysis && (
          <div className="alert alert-info">
            <span>
              {analysis.prompt} Next mode suggestion:{" "}
              <strong>{analysis.nextMode}</strong>
            </span>
          </div>
        )}
        {isSaving && (
          <span className="loading loading-spinner text-primary">
            Saving drawing...
          </span>
        )}
      </div>
      <EmotionVisualizer />
    </div>
  );
}

export default Draw;
