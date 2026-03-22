import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#D97706',
      color: 'white',
      padding: '10px 16px',
      textAlign: 'center',
      fontSize: '13px',
      fontFamily: 'OpenDyslexic, Arial, sans-serif',
      zIndex: 9999,
    }}>
      You are offline. Previously loaded content is still available.
    </div>
  );
}
