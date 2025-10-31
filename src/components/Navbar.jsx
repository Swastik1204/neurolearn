import { Link, NavLink } from "react-router-dom";
import { FaBrain } from "react-icons/fa";
import { logout } from "../firebase/auth.js";
import { useAppContext } from "../context/AppContext.jsx";
import BrightnessControl from "./BrightnessControl.jsx";
import ThemeController from "./ThemeController.jsx";

function Navbar() {
  const { state, showAuthModal } = useAppContext();

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h8m-8 6h16"
              />
            </svg>
          </label>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
          >
            {state.user ? (
              <>
                <li className="menu-title">
                  <span>Hi, {state.user.displayName || "Learner"}!</span>
                </li>
                <li>
                  <NavLink to="/">Home</NavLink>
                </li>
                <li>
                  <NavLink to="/learn">Learn</NavLink>
                </li>
                <li>
                  <NavLink to="/draw">Draw</NavLink>
                </li>
                <li>
                  <NavLink to="/profile">Progress</NavLink>
                </li>
                <li>
                  <button onClick={handleLogout}>Logout</button>
                </li>
              </>
            ) : null}
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
              <li>
                <span className="text-sm">
                  Hi, {state.user.displayName || "Learner"}!
                </span>
              </li>
              <li>
                <NavLink to="/">Home</NavLink>
              </li>
              <li>
                <NavLink to="/learn">Learn</NavLink>
              </li>
              <li>
                <NavLink to="/draw">Draw</NavLink>
              </li>
              <li>
                <NavLink to="/profile">Progress</NavLink>
              </li>
              <li>
                <button onClick={handleLogout} className="btn btn-ghost">
                  Logout
                </button>
              </li>
            </>
          ) : null}
        </ul>
      </div>

      <div className="navbar-end flex items-center gap-3">
        <ThemeController />
        <BrightnessControl />
        {state.user ? (
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-circle avatar placeholder"
            >
              <div className="bg-primary text-primary-content rounded-full w-8">
                <span className="text-sm font-bold">
                  {(state.user.displayName || state.user.email || "U")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
            >
              <li className="menu-title">
                <span className="text-sm font-medium">
                  {state.user.displayName || "Learner"}
                </span>
              </li>
              <li>
                <NavLink to="/profile">Profile</NavLink>
              </li>
              <li>
                <button onClick={handleLogout}>Logout</button>
              </li>
            </ul>
          </div>
        ) : (
          <button onClick={showAuthModal} className="btn btn-primary">
            Login
          </button>
        )}
      </div>
    </div>
  );
}

export default Navbar;
