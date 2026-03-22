import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function FocusMode({ children, enabled: initialEnabled = false }) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setEnabled(!enabled)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-border shadow-lg hover:shadow-xl transition-all text-sm font-medium"
        aria-label={enabled ? 'Exit focus mode' : 'Enter focus mode'}
      >
        {enabled ? (
          <>
            <EyeOff className="w-4 h-4 text-primary" />
            <span className="text-foreground">Exit Focus</span>
          </>
        ) : (
          <>
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Focus Mode</span>
          </>
        )}
      </button>

      {/* When enabled, render only the children with minimal chrome */}
      {enabled ? (
        <div className="fixed inset-0 z-40 bg-background flex items-center justify-center p-8">
          <div className="w-full max-w-3xl">
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
