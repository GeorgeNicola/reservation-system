import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import "./Login.css";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  // Field-level errors
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  if (isAuthenticated) return <Navigate to="/" replace />;

  const validate = (): boolean => {
    let valid = true;
    setEmailError("");
    setPasswordError("");

    if (!email.trim()) {
      setEmailError("Email-ul este obligatoriu");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Te rugăm să introduci un email valid");
      valid = false;
    }

    if (!password) {
      setPasswordError("Parola este obligatorie");
      valid = false;
    }

    if (!valid) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await login(email, password);
      const state = location.state as { from?: { pathname?: string } } | null;
      const from = state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ||
            "Autentificarea a eșuat. Te rugăm să încerci din nou.",
        );
      } else {
        setError("Autentificarea a eșuat. Te rugăm să încerci din nou.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className={`auth-card ${shaking ? "animate-shake" : ""}`}>
        <div className="auth-header">
          <div className="auth-header-icon">🔐</div>
          <h1>Bine ai revenit</h1>
          <p>Autentifică-te în contul tău</p>
        </div>

        {error && <div className="auth-error-banner">❌ {error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email
            </label>
            <div className="input-with-status">
              <input
                id="login-email"
                type="email"
                className={`form-input ${emailError ? "input-error" : ""}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
              />
            </div>
            {emailError && <div className="form-error">{emailError}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div className="input-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className={`form-input ${passwordError ? "input-error" : ""}`}
                placeholder="Introdu parola ta"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
              />
              <button
                type="button"
                className="input-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            {passwordError && <div className="form-error">{passwordError}</div>}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Autentifică-te"}
          </button>
        </form>

        <div className="auth-footer">
          Nu ai un cont? <Link to="/register">Înregistrează-te</Link>
        </div>
      </div>
    </div>
  );
}
