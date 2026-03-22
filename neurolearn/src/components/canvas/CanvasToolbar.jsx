import { Eraser, Undo2, Send, Trash2 } from 'lucide-react';

export default function CanvasToolbar({ onClear, onUndo, onSubmit, canUndo, isSubmitting }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        onClick={onClear}
        className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all font-medium text-sm"
        aria-label="Clear canvas"
      >
        <Trash2 className="w-4 h-4" />
        Clear
      </button>

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Undo last stroke"
      >
        <Undo2 className="w-4 h-4" />
        Undo
      </button>

      <div className="flex-1" />

      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Submit handwriting"
      >
        {isSubmitting ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit
          </>
        )}
      </button>
    </div>
  );
}
