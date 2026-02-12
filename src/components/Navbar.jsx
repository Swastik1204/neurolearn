import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { logout } from "../firebase/auth.js";
import { useAppContext } from "../context/AppContext.jsx";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/learn", label: "Learn" },
  { to: "/alphabet", label: "Alphabet" },
  { to: "/draw", label: "Games" },
  { to: "/profile", label: "Progress" },
];

function Navbar() {
  const { state, showAuthModal } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const userInitial = state.user
    ? (state.user.displayName || state.user.email || "U").charAt(0).toUpperCase()
    : "";

  return (
    <nav className="sticky top-6 z-50 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="glass-panel rounded-full px-6 h-20 flex justify-between items-center shadow-lg">
        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#f472b6] flex items-center justify-center text-white shadow-glow">
            <span className="material-symbols-rounded text-2xl">psychology</span>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-slate-800">
            NeuroLearn
          </span>
        </Link>

        {/* ── Desktop nav links ── */}
        <div className="hidden md:flex items-center space-x-2 bg-white/30 p-1.5 rounded-full backdrop-blur-sm border border-white/20">
          {state.user ? (
            navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white bg-slate-900 shadow-md font-semibold scale-105"
                      : "text-slate-600 hover:bg-white/40"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))
          ) : (
            <NavLink
              to="/"
              className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-slate-900 shadow-md"
            >
              Home
            </NavLink>
          )}
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-4">
          {state.user ? (
            <>
              {/* Notification bell */}
              <button className="w-10 h-10 rounded-full glass-button flex items-center justify-center text-slate-600">
                <span className="material-symbols-rounded">notifications</span>
              </button>

              {/* User avatar & dropdown */}
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200/50">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-800 leading-none">
                    {state.user.displayName || "Learner"}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">Level 4</p>
                </div>

                <div className="dropdown dropdown-end">
                  <button
                    tabIndex={0}
                    className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-[#6366f1] text-white flex items-center justify-center font-bold shadow-md ring-2 ring-white/50"
                  >
                    {userInitial}
                  </button>
                  <ul
                    tabIndex={0}
                    className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-glass-card bg-white/90 backdrop-blur-xl rounded-2xl w-52 border border-white/40"
                  >
                    <li className="menu-title">
                      <span className="text-sm font-medium text-slate-700">
                        {state.user.displayName || "Learner"}
                      </span>
                    </li>
                    <li>
                      <NavLink to="/profile" className="text-slate-600 hover:text-slate-800">
                        Profile
                      </NavLink>
                    </li>
                    <li>
                      <button onClick={handleLogout} className="text-slate-600 hover:text-slate-800">
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={showAuthModal}
              className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-full shadow-md hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300 text-sm"
            >
              Login
            </button>
          )}

          {/* ── Mobile hamburger ── */}
          <button
            className="md:hidden w-10 h-10 rounded-full glass-button flex items-center justify-center text-slate-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="material-symbols-rounded">
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile nav drawer ── */}
      {mobileOpen && state.user && (
        <div className="md:hidden mt-3 glass-panel rounded-2xl p-4 space-y-1 animate-[fadeIn_0.2s_ease-out]">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "text-white bg-slate-900"
                    : "text-slate-600 hover:bg-white/40"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <button
            onClick={() => { handleLogout(); setMobileOpen(false); }}
            className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50/50 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
