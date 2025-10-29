import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FaBrain } from "react-icons/fa";
import { HiMiniSparkles } from "react-icons/hi2";

function Navbar() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const navItemClass = ({ isActive }) =>
    `btn btn-ghost btn-sm normal-case font-semibold ${
      isActive ? "text-primary" : "text-slate-600"
    }`;

  return (
    <nav className="border-b border-base-300 bg-base-100/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-content">
            <FaBrain size={22} />
          </span>
          <div className="leading-tight">
            <p>NeuroLearn</p>
            <p className="text-xs font-normal text-slate-500">
              Adaptive AI tutor for bright minds
            </p>
          </div>
        </Link>

        <button
          type="button"
          className="btn btn-ghost btn-circle lg:hidden"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                isMenuOpen
                  ? "M6 18L18 6M6 6l12 12"
                  : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              }
            />
          </svg>
        </button>

        <div className="hidden items-center gap-2 lg:flex">
          <NavLink to="/" className={navItemClass}>
            Home
          </NavLink>
          <NavLink to="/learn" className={navItemClass}>
            Learn
          </NavLink>
          <NavLink to="/draw" className={navItemClass}>
            Draw
          </NavLink>
          <NavLink to="/profile" className={navItemClass}>
            Progress
          </NavLink>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm hidden items-center gap-2 lg:flex"
          disabled={!deferredPrompt}
          onClick={handleInstallClick}
        >
          <HiMiniSparkles size={18} />
          Install App
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-base-300 bg-base-100 px-4 py-2 lg:hidden">
          <div className="flex flex-col gap-2">
            <NavLink
              to="/"
              className={navItemClass}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/learn"
              className={navItemClass}
              onClick={() => setIsMenuOpen(false)}
            >
              Learn
            </NavLink>
            <NavLink
              to="/draw"
              className={navItemClass}
              onClick={() => setIsMenuOpen(false)}
            >
              Draw
            </NavLink>
            <NavLink
              to="/profile"
              className={navItemClass}
              onClick={() => setIsMenuOpen(false)}
            >
              Progress
            </NavLink>
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2 flex items-center gap-2"
              disabled={!deferredPrompt}
              onClick={() => {
                handleInstallClick();
                setIsMenuOpen(false);
              }}
            >
              <HiMiniSparkles size={18} />
              Install App
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
