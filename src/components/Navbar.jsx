import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FaBrain } from "react-icons/fa";
import { HiMiniSparkles } from "react-icons/hi2";
import { logout } from "../firebase/auth.js";
import { useAppContext } from "../context/AppContext.jsx";

function Navbar() {
  const { state } = useAppContext();
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="navbar-start">
        <div className="dropdown">
          <label tabIndex={0} className="btn btn-ghost lg:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </label>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            {state.user ? (
              <>
                <li className="menu-title">
                  <span>Hi, {state.user.displayName || "Learner"}!</span>
                </li>
                <li><NavLink to="/">Home</NavLink></li>
                <li><NavLink to="/learn">Learn</NavLink></li>
                <li><NavLink to="/draw">Draw</NavLink></li>
                <li><NavLink to="/profile">Progress</NavLink></li>
                <li><button onClick={handleLogout}>Logout</button></li>
              </>
            ) : (
              <li><NavLink to="/login">Login</NavLink></li>
            )}
            <li><button onClick={handleInstallClick} disabled={!deferredPrompt} className="flex items-center gap-2">
              <HiMiniSparkles size={16} />
              Install App
            </button></li>
          </ul>
        </div>
        <Link to="/" className="btn btn-ghost normal-case text-xl">
          <FaBrain className="text-primary" />
          NeuroLearn
        </Link>
      </div>

      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          {state.user ? (
            <>
              <li><span className="text-sm">Hi, {state.user.displayName || "Learner"}!</span></li>
              <li><NavLink to="/">Home</NavLink></li>
              <li><NavLink to="/learn">Learn</NavLink></li>
              <li><NavLink to="/draw">Draw</NavLink></li>
              <li><NavLink to="/profile">Progress</NavLink></li>
              <li><button onClick={handleLogout} className="btn btn-ghost">Logout</button></li>
            </>
          ) : (
            <li><NavLink to="/login">Login</NavLink></li>
          )}
        </ul>
      </div>

      <div className="navbar-end">
        <button
          type="button"
          className="btn btn-primary btn-sm hidden lg:flex items-center gap-2"
          disabled={!deferredPrompt}
          onClick={handleInstallClick}
        >
          <HiMiniSparkles size={16} />
          Install App
        </button>
      </div>
    </div>
  );
}

export default Navbar;
