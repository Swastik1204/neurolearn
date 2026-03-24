import { create } from 'zustand';
import { auth, db } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  studentIds: [],
  loading: true,
  initialized: false,

  setUser: (user, role, studentIds = []) =>
    set({ user, role, studentIds, loading: false }),

  clearUser: () =>
    set({ user: null, role: null, studentIds: [], loading: false }),

  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });

    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            set({
              user: {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || userData.displayName,
                photoURL: firebaseUser.photoURL,
              },
              role: userData.role,
              studentIds: userData.linkedStudentIds || [],
              loading: false,
            });
          } else {
            // User exists in Auth but not in Firestore yet
            set({
              user: {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
              },
              role: null,
              studentIds: [],
              loading: false,
            });
          }
        } catch (error) {
          console.error('Signup error full details (authStore):', error.code, error.message, error);
          set({ user: null, role: null, studentIds: [], loading: false });
        }
      } else {
        set({ user: null, role: null, studentIds: [], loading: false });
      }
    });
  },
}));

export default useAuthStore;
