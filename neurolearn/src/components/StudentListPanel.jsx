import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs,
  doc, setDoc, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import {
  X, UserPlus, Loader2, CheckCircle, Search, Users, User,
} from 'lucide-react';

export default function StudentListPanel({ role, linkedStudentIds = [], onSuccess, onClose }) {
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [successId, setSuccessId] = useState(null);

  // Fetch all students from the users collection
  useEffect(() => {
    const fetchAllStudents = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const snap = await getDocs(q);
        const students = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllStudents(students);
      } catch (err) {
        console.error('Error fetching students:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAllStudents();
  }, []);

  // Check if student is already linked
  // linkedStudentIds contains doc IDs from /students collection, but we also
  // need to check against the fetched student doc UIDs from /students
  const [linkedUids, setLinkedUids] = useState([]);

  useEffect(() => {
    if (!linkedStudentIds?.length) return;
    const fetchLinkedUids = async () => {
      try {
        const uids = [];
        for (const docId of linkedStudentIds) {
          const studentsRef = collection(db, 'students');
          const q = query(studentsRef);
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            if (linkedStudentIds.includes(d.id)) {
              uids.push(d.data().uid);
            }
          });
          break; // only need one query
        }
        setLinkedUids(uids);
      } catch (err) {
        console.error('Error fetching linked UIDs:', err);
      }
    };
    fetchLinkedUids();
  }, [linkedStudentIds]);

  const isLinked = (student) => {
    const uid = student.uid || student.id;
    return linkedStudentIds.includes(uid) || linkedUids.includes(uid);
  };

  // Connect to a student
  const handleConnect = async (student) => {
    const studentUid = student.uid || student.id; // doc id in /users IS the firebase auth UID
    setConnectingId(studentUid);
    try {
      if (!auth.currentUser) throw new Error('You must be logged in to connect.');

      const studentName = student.displayName || 'Student';
      const currentUid = auth.currentUser.uid;

      // 1. Check/Create student profile in /students collection
      const studentsRef = collection(db, 'students');
      const studentQuery = query(studentsRef, where('uid', '==', studentUid));
      const studentSnapshot = await getDocs(studentQuery);

      let studentDocId;
      if (studentSnapshot.empty) {
        const newStudentDoc = doc(studentsRef);
        studentDocId = newStudentDoc.id;
        await setDoc(newStudentDoc, {
          uid: studentUid,
          displayName: studentName,
          guardianId: role === 'guardian' ? currentUid : '',
          teacherId: role === 'teacher' ? currentUid : '',
          createdAt: new Date().toISOString(),
        });
      } else {
        studentDocId = studentSnapshot.docs[0].id;
        const updateData = {};
        if (role === 'guardian') updateData.guardianId = currentUid;
        if (role === 'teacher') updateData.teacherId = currentUid;
        if (Object.keys(updateData).length > 0) {
          await updateDoc(doc(db, 'students', studentDocId), updateData);
        }
      }

      // 2. Update the Guardian/Teacher's /users document
      const userRef = doc(db, 'users', currentUid);
      await updateDoc(userRef, {
        linkedStudentIds: arrayUnion(studentDocId),
      });

      // 3. Update the Student's /users record with the link back
      const studentUserRef = doc(db, 'users', studentUid);
      const studentUpdate = {};
      if (role === 'guardian') studentUpdate.guardianId = currentUid;
      if (role === 'teacher') studentUpdate.teacherId = currentUid;
      if (Object.keys(studentUpdate).length > 0) {
        await updateDoc(studentUserRef, studentUpdate);
      }

      setSuccessId(studentUid);

      // Delay then trigger success callback
      setTimeout(() => {
        if (onSuccess) onSuccess(studentDocId);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Linking error:', err);
      alert(err.message || 'Failed to connect with student.');
    } finally {
      setConnectingId(null);
    }
  };

  // Client-side search filter
  const filtered = allStudents.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.displayName || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30 flex-shrink-0">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Browse Students
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading students...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No students match your search.' : 'No student accounts found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {filtered.map((student) => {
                const studentUid = student.uid || student.id;
                const linked = isLinked(student);
                const isConnecting = connectingId === studentUid;
                const justConnected = successId === studentUid;
                const initial = (student.displayName || student.email || '?')[0].toUpperCase();

                return (
                  <div
                    key={student.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      linked || justConnected
                        ? 'border-success/30 bg-success/5'
                        : 'border-border hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        linked || justConnected
                          ? 'bg-success/20 text-success'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {initial}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {student.displayName || 'Student'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {student.email}
                      </p>
                    </div>

                    {/* Action */}
                    {linked || justConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Connected
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConnect(student)}
                        disabled={isConnecting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            Connect
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex-shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>
    </div>
  );
}
