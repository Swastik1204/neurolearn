import { useState, useEffect } from "react";
import { FiDownload } from "react-icons/fi";

export default function FloatingInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      // Check if running in standalone mode (PWA)
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)"
      ).matches;
      // Check if running as PWA on iOS
      const isIOSPWA = window.navigator.standalone === true;
      // Check if installed via beforeinstallprompt
      const hasDeferredPrompt = deferredPrompt !== null;

      setIsInstalled(isStandalone || isIOSPWA || !hasDeferredPrompt);
    };

    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      checkIfInstalled();
    };

    // Listen for the beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", handler);

    // Check if app is already installed on component mount
    checkIfInstalled();

    // Also check when the app becomes installed
    const installHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", installHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installHandler);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  // Don't show if already installed or no install prompt available
  if (isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleInstallClick}
      className="fixed bottom-6 right-6 btn btn-primary shadow-lg z-50 heartbeat-animation hover:scale-110 transition-transform flex items-center gap-2 px-4"
      title="Install NeuroLearn App"
    >
      <FiDownload size={20} />
      <span className="text-sm font-medium">Install APP</span>
    </button>
  );
}
