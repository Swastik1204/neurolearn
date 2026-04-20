import { useState } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { searchStudents } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { X, UserPlus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function LinkStudentModal({ onSuccess, onClose }) {
  const addStudentId = useAuthStore((state) => state.addStudentId);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const normalize = (value = '') => value.trim().toLowerCase();

  const handleSearch = async () => {
    const term = normalize(email);
    if (!term) {
      setSearchResults([]);
      setError('Enter a student name or email to search.');
      return;
    }

    setSearching(true);
    setError('');
    setSelectedStudent(null);

    try {
      const response = await searchStudents(term);
      const matches = response.data?.results || [];

      setSearchResults(matches);
      setSelectedStudent(matches[0] || null);
      if (matches.length === 0) {
        setError('No student matched that search. Try a different name or email.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Could not search students right now. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!selectedStudent) {
        throw new Error('Search for a student first, then link the matching result.');
      }

      const studentUid = selectedStudent.id;
      const studentData = selectedStudent;
      const studentName = studentData.displayName || 'Student';

      // Update the Guardian/Teacher's /users document
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
            Search for a student by name or email, then link the matching account.
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
              Search Student
            </label>
            <input
              id="student-email"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Type a name or email"
              className="w-full px-4 py-3 rounded-xl border border-input bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
              autoFocus
              disabled={loading || !!success}
            />
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || searching || !!success}
            className="w-full px-4 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-all disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.slice(0, 5).map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    setEmail(student.email || student.displayName || '');
                    setSelectedStudent(student);
                  }}
                  className="w-full text-left rounded-xl border border-border bg-muted/30 px-4 py-3 hover:bg-primary/5 transition-all"
                >
                  <div className="font-medium text-foreground">{student.displayName || 'Student'}</div>
                  <div className="text-xs text-muted-foreground">{student.email}</div>
                </button>
              ))}
            </div>
          )}

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
              disabled={loading || !!success || searchResults.length === 0}
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
