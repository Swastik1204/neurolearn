import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import FloatingInstallButton from "./components/FloatingInstallButton.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Home from "./pages/Home.jsx";
import Learn from "./pages/Learn.jsx";
import Draw from "./pages/Draw.jsx";
import Profile from "./pages/Profile.jsx";
import AlphabetLearn from "./pages/AlphabetLearn.jsx";
import { AppProvider, useAppContext } from "./context/AppContext.jsx";
import logger from "./debug/logger.js";
import "./App.css";

// Dev-only DebugPanel (tree-shaken in production)
const DebugPanel = import.meta.env.DEV
  ? (await import("./components/DebugPanel.jsx")).default
  : () => null;

const log = logger.create("App");

document.documentElement.setAttribute("data-theme", "neurolearn");

// Register the service worker to enable installable PWA behavior.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => log.info("Service worker registered"))
      .catch((error) =>
        log.error("Service worker registration failed", error)
      );
  });
}

function AppContent() {
  const { state } = useAppContext();

  return (
    <div className="min-h-screen text-slate-700 antialiased selection:bg-[#6366f1]/30 relative">
      {/* ── Animated background blobs ── */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6366f1]/20 rounded-full blur-[100px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#f472b6]/20 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-[#8b5cf6]/20 rounded-full blur-[80px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <Navbar />
      <AuthModal />
      <FloatingInstallButton />
      <DebugPanel />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={state.user ? <Learn /> : <Navigate to="/" replace />} />
          <Route path="/draw" element={state.user ? <Draw /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={state.user ? <Profile /> : <Navigate to="/" replace />} />
          <Route path="/alphabet" element={state.user ? <AlphabetLearn /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 py-8 border-t border-white/20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm font-medium">
            © 2024 NeuroLearn. Empowering every mind.
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <StrictMode>
      <BrowserRouter>
        <AppProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AppProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

export default App;

// Initialize the app
const rootElement = document.getElementById("root");
const root = createRoot(rootElement);
root.render(<App />);
