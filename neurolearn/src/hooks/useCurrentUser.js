import { useEffect } from 'react';
import useAuthStore from '@/store/authStore';

export default function useCurrentUser() {
  const { user, role, studentIds, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { user, role, studentIds, loading };
}
