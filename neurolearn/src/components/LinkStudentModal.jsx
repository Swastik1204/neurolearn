import { useState } from 'react';
import { 
  collection, query, where, getDocs,
  doc, updateDoc, arrayUnion
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import useAuthStore from '@/store/authStore';
import { X, UserPlus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function LinkStudentModal({ onSuccess, onClose }) {
  const addStudentId = useAuthStore((state) => state.addStudentId);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLink = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Search for student by email in /users
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email), where('role', '==', 'student'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('No student account found with that email. Please ensure the student has already signed up.');
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      const studentUid = studentDoc.id;
      const studentName = studentData.displayName || 'Student';

      // 2. Update the Guardian/Teacher's /users document
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        linkedStudentIds: arrayUnion(studentUid)
      });

      addStudentId(studentUid);

      setSuccess(`Successfully linked with ${studentName}!`);
      
      // Delay closing to show success message
      setTimeout(() => {
        if (onSuccess) onSuccess(studentUid);
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Linking error:', err);
      setError(err.message || 'An unexpected error occurred during linking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Link a Student
          </h3>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLink} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Link a student's account to view their progress and reports. 
            Enter the email address the student used to sign up for NeuroLearn.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2 shadow-sm">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="student-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Student's Email Address
            </label>
            <input
              id="student-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="w-full px-4 py-3 rounded-xl border border-input bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
              autoFocus
              disabled={loading || !!success}
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || !!success}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!success}
              className="flex-1 px-4 py-3 rounded-xl gradient-primary text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:opacity-90"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Linking...</span>
                </div>
              ) : (
                <span>Link Student</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
