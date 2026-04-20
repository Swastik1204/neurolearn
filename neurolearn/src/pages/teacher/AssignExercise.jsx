import { X } from 'lucide-react';

export default function AssignExercise({ studentName, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-xl shadow-2xl border border-border max-w-md w-full animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg text-foreground">Assign Exercise</h2>
            <p className="text-sm text-muted-foreground">To: {studentName}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Exercise assignment has been retired in the simplified schema. Use linked students and the handwriting practice flow instead.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-all shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
