import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';

const EXERCISE_TYPES = [
  { value: 'writing', label: 'Writing Practice' },
  { value: 'reading', label: 'Reading Exercise' },
  { value: 'phonics', label: 'Phonics Drill' },
];

export default function AssignExercise({ studentId, studentName, onClose, onAssigned }) {
  const { user } = useCurrentUser();
  const [exerciseType, setExerciseType] = useState('writing');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        studentId,
        teacherId: user.uid,
        exerciseType,
        dueDate,
        notes,
        status: 'assigned',
        createdAt: serverTimestamp(),
      });
      if (onAssigned) onAssigned();
      onClose();
    } catch (err) {
      console.error('Failed to assign exercise:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="exercise-type" className="block text-sm font-medium text-foreground mb-1.5">
              Exercise Type
            </label>
            <select
              id="exercise-type"
              value={exerciseType}
              onChange={(e) => setExerciseType(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            >
              {EXERCISE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="due-date" className="block text-sm font-medium text-foreground mb-1.5">
              Due Date
            </label>
            <div className="relative">
              <input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-1.5">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
              placeholder="Any special instructions..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
            >
              {submitting ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
