import { Navigate, useLocation } from 'react-router-dom';
import useCurrentUser from '@/hooks/useCurrentUser';
import { BookOpen } from 'lucide-react';

export default function AuthGuard({ children, allowedRoles }) {
  const { user, role, loading } = useCurrentUser();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg animate-pulse-gentle">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to their own dashboard
    const roleRoutes = {
      student: '/student',
      guardian: '/guardian',
      teacher: '/teacher',
    };
    return <Navigate to={roleRoutes[role] || '/login'} replace />;
  }

  return children;
}
