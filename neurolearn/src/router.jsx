import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthGuard from '@/components/AuthGuard';
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import StudentHome from '@/pages/student/StudentHome';
import WritingExercise from '@/pages/student/WritingExercise';
import ExerciseComplete from '@/pages/student/ExerciseComplete';
import GuardianDashboard from '@/pages/guardian/GuardianDashboard';
import TeacherDashboard from '@/pages/teacher/TeacherDashboard';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/signup',
    element: <Signup />,
  },

  // Student Routes
  {
    path: '/student',
    element: (
      <AuthGuard allowedRoles={['student']}>
        <StudentHome />
      </AuthGuard>
    ),
  },
  {
    path: '/student/exercise',
    element: (
      <AuthGuard allowedRoles={['student']}>
        <WritingExercise />
      </AuthGuard>
    ),
  },
  {
    path: '/student/complete',
    element: (
      <AuthGuard allowedRoles={['student']}>
        <ExerciseComplete />
      </AuthGuard>
    ),
  },

  // Guardian Routes
  {
    path: '/guardian',
    element: (
      <AuthGuard allowedRoles={['guardian']}>
        <GuardianDashboard />
      </AuthGuard>
    ),
  },

  // Teacher Routes
  {
    path: '/teacher',
    element: (
      <AuthGuard allowedRoles={['teacher']}>
        <TeacherDashboard />
      </AuthGuard>
    ),
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);

export default router;
