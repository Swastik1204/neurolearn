import { useState } from "react";
import { FaBrain } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { login, registerChild, loginWithGoogle } from "../firebase/auth.js";
import { createUserProfile } from "../firebase/db.js";
import { useAppContext } from "../context/AppContext.jsx";

function AuthModal() {
  const { state, setUser, hideAuthModal } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let user;
      if (isLogin) {
        user = await login({
          email: formData.email,
          password: formData.password,
        });
      } else {
        user = await registerChild({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
        });

        // Create user profile in Firestore
        await createUserProfile(user.uid, {
          name: formData.displayName,
          learningStyle: "visual",
          progressId: user.uid,
        });
      }

      setUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });

      // Reset form and close modal
      setFormData({ email: "", password: "", displayName: "" });
      setError("");
      hideAuthModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setFormData({ email: "", password: "", displayName: "" });
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const user = await loginWithGoogle();

      // Create user profile in Firestore if it's a new user
      await createUserProfile(user.uid, {
        name: user.displayName || "Google User",
        learningStyle: "visual",
        progressId: user.uid,
      });

      setUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });

      hideAuthModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!state.authModal.isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-full mb-4">
            <FaBrain className="text-primary-content text-xl" />
          </div>
          <h3 className="font-bold text-lg">
            {isLogin ? "Welcome Back!" : "Join NeuroLearn"}
          </h3>
          <p className="py-2 text-sm text-base-content/70">
            {isLogin ? "Sign in to continue your learning journey" : "Create your account to start learning"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="label">
                <span className="label-text">Display Name</span>
              </label>
              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="Your name"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              isLogin ? "Sign In" : "Create Account"
            )}
          </button>
        </form>

        <div className="divider">OR</div>

        <button
          type="button"
          className="btn btn-outline w-full mb-3 flex items-center justify-center gap-2"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <FcGoogle size={20} />
          {isLogin ? "Sign in with Google" : "Sign up with Google"}
        </button>

        <button
          type="button"
          className="btn btn-outline w-full"
          onClick={switchMode}
        >
          {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={hideAuthModal}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;