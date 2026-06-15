import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import "../Login/Login.css";

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "patient" as "patient" | "doctor",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (isAuthenticated && !showSuccess) return <Navigate to="/" replace />;

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error on type
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const isFieldValid = (field: string): boolean => {
    if (!form[field as keyof typeof form]) return false;
    if (errors[field]) return false;

    switch (field) {
      case "full_name":
        return (form.full_name as string).length >= 2;
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      case "password":
        return (
          form.password.length >= 6 &&
          /[a-zA-Z]/.test(form.password) &&
          /\d/.test(form.password)
        );
      case "confirmPassword":
        return (
          form.confirmPassword === form.password &&
          form.confirmPassword.length > 0
        );
      case "phone":
        return !form.phone || form.phone.replace(/\D/g, "").length >= 10;
      default:
        return true;
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.full_name || form.full_name.length < 2) {
      errs.full_name = "Numele trebuie să aibă cel puțin 2 caractere";
    }

    if (!form.email) {
      errs.email = "Email-ul este obligatoriu";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Te rugăm să introduci un email valid";
    }

    if (!form.password) {
      errs.password = "Parola este obligatorie";
    } else if (form.password.length < 6) {
      errs.password = "Parola trebuie să aibă cel puțin 6 caractere";
    } else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
      errs.password = "Parola trebuie să conțină cel puțin 1 literă și 1 număr";
    }

    if (form.confirmPassword !== form.password) {
      errs.confirmPassword = "Parolele nu se potrivesc";
    }

    if (form.phone && form.phone.replace(/\D/g, "").length < 10) {
      errs.phone = "Telefonul trebuie să aibă cel puțin 10 cifre";
    }

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || undefined,
        role: form.role,
      });
      setShowSuccess(true);
      setTimeout(() => navigate("/"), 1200);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setServerError(
          err.response?.data?.error ||
            "Înregistrarea a eșuat. Te rugăm să încerci din nou.",
        );
      } else {
        setServerError("Înregistrarea a eșuat. Te rugăm să încerci din nou.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="auth-success-overlay">
        <div className="auth-success-check">✓</div>
      </div>
    );
  }

  const fields = [
    {
      key: "full_name",
      label: "Nume Complet",
      type: "text",
      placeholder: "John Doe",
      delay: 1,
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      placeholder: "you@example.com",
      delay: 2,
    },
    {
      key: "phone",
      label: "Telefon (opțional)",
      type: "tel",
      placeholder: "+40 712 345 678",
      delay: 3,
    },
  ];

  return (
    <div className="auth-page">
      <div
        className={`auth-card ${shaking ? "animate-shake" : ""}`}
        style={{ maxWidth: 480 }}
      >
        <div className="auth-header">
          <div className="auth-header-icon">✨</div>
          <h1>Creează Cont</h1>
          <p>Alătură-te ReserveMD astăzi</p>
        </div>

        {serverError && (
          <div className="auth-error-banner">❌ {serverError}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {fields.map((f) => (
            <div
              className={`form-group animate-fade-up stagger-${f.delay}`}
              key={f.key}
            >
              <label className="form-label" htmlFor={`reg-${f.key}`}>
                {f.label}
              </label>
              <div className="input-with-status">
                <input
                  id={`reg-${f.key}`}
                  type={f.type}
                  className={`form-input ${errors[f.key] ? "input-error" : isFieldValid(f.key) ? "input-success" : ""}`}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form] as string}
                  onChange={(e) => updateField(f.key, e.target.value)}
                />
                {isFieldValid(f.key) && <span className="input-check">✓</span>}
              </div>
              {errors[f.key] && (
                <div className="form-error">{errors[f.key]}</div>
              )}
            </div>
          ))}

          {/* Password */}
          <div className="form-group animate-fade-up stagger-4">
            <label className="form-label" htmlFor="reg-password">
              Parola
            </label>
            <div className="input-password-wrapper input-with-status">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.password ? "input-error" : isFieldValid("password") ? "input-success" : ""}`}
                placeholder="Minim 6 caractere, 1 literă + 1 cifră"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
              />
              <button
                type="button"
                className="input-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
              {isFieldValid("password") && (
                <span className="input-check">✓</span>
              )}
            </div>
            {errors.password && (
              <div className="form-error">{errors.password}</div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group animate-fade-up stagger-5">
            <label className="form-label" htmlFor="reg-confirm">
              Confirmă Parola
            </label>
            <div className="input-with-status">
              <input
                id="reg-confirm"
                type="password"
                className={`form-input ${errors.confirmPassword ? "input-error" : isFieldValid("confirmPassword") ? "input-success" : ""}`}
                placeholder="Repetă parola"
                value={form.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
              />
              {isFieldValid("confirmPassword") && (
                <span className="input-check">✓</span>
              )}
            </div>
            {errors.confirmPassword && (
              <div className="form-error">{errors.confirmPassword}</div>
            )}
          </div>

          {/* Role Toggle */}
          <div className="form-group animate-fade-up stagger-6">
            <label className="form-label">Sunt un</label>
            <div className="role-toggle">
              <button
                type="button"
                className={`role-toggle-option ${form.role === "patient" ? "active" : ""}`}
                onClick={() => updateField("role", "patient")}
              >
                🩹 Pacient
              </button>
              <button
                type="button"
                className={`role-toggle-option ${form.role === "doctor" ? "active" : ""}`}
                onClick={() => updateField("role", "doctor")}
              >
                🩺 Medic
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Creează Cont"}
          </button>
        </form>

        <div className="auth-footer">
          Ai deja un cont? <Link to="/login">Autentifică-te</Link>
        </div>
      </div>
    </div>
  );
}
