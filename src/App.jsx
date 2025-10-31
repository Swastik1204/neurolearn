import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import FloatingInstallButton from "./components/FloatingInstallButton.jsx";
import Home from "./pages/Home.jsx";
import Learn from "./pages/Learn.jsx";
import Draw from "./pages/Draw.jsx";
import Profile from "./pages/Profile.jsx";
import { AppProvider, useAppContext } from "./context/AppContext.jsx";
import "./App.css";

document.documentElement.setAttribute("data-theme", "neurolearn");

// Register the service worker to enable installable PWA behavior.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((error) =>
        console.error("Service worker registration failed", error)
      );
  });
}

function AppContent() {
  const { state } = useAppContext();

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Navbar />
      <AuthModal />
      <FloatingInstallButton />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/learn"
            element={state.user ? <Learn /> : <Navigate to="/" replace />}
          />
          <Route
            path="/draw"
            element={state.user ? <Draw /> : <Navigate to="/" replace />}
          />
          <Route
            path="/profile"
            element={state.user ? <Profile /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <StrictMode>
      <BrowserRouter>
        <AppProvider>
          <AppContent />
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
