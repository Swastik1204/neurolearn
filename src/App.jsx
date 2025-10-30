import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import FloatingInstallButton from "./components/FloatingInstallButton.jsx";
import Home from "./pages/Home.jsx";
import Learn from "./pages/Learn.jsx";
import Draw from "./pages/Draw.jsx";
import Profile from "./pages/Profile.jsx";
import { useAppContext } from "./context/AppContext.jsx";

function App() {
  const { state, showAuthModal } = useAppContext();

  // Global auth guard - show modal if user tries to access protected routes without authentication
  useEffect(() => {
    if (!state.user && (window.location.pathname === '/learn' || window.location.pathname === '/draw' || window.location.pathname === '/profile')) {
      showAuthModal();
    }
  }, [state.user, showAuthModal]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Navbar />
      <AuthModal />
      <FloatingInstallButton />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={state.user ? <Learn /> : null} />
          <Route path="/draw" element={state.user ? <Draw /> : null} />
          <Route path="/profile" element={state.user ? <Profile /> : null} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
