import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBrain } from "react-icons/fa";
import { login, registerChild } from "../firebase/auth.js";
import { createUserProfile } from "../firebase/db.js";
import { useAppContext } from "../context/AppContext.jsx";

function Login() {
  const navigate = useNavigate();
  const { setUser } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    age: "",
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
          age: parseInt(formData.age) || 7,
          learningStyle: "visual",
          progressId: user.uid,
        });
      }

      setUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        age: parseInt(formData.age) || 7,
      });

      navigate("/");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <FaBrain className="text-primary-content text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome to NeuroLearn
          </h1>
          <p className="text-slate-600 mt-2">
            {isLogin ? "Sign in to continue learning" : "Create your learning profile"}
          </p>
        </div>

        <div className="bg-base-100 rounded-3xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
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
                <div>
                  <label className="label">
                    <span className="label-text">Age</span>
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    className="input input-bordered w-full"
                    placeholder="7"
                    min="3"
                    max="18"
                    required={!isLogin}
                  />
                </div>
              </>
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
            className="btn btn-outline w-full"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>

          <div className="text-center mt-6">
            <Link to="/" className="link link-primary">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;