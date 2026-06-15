import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import api from "../../api/axios";
import axios from "axios";
import "./CreateClinic.css";

const SPECIALTIES = [
  "Cardiologie",
  "Stomatologie",
  "Dermatologie",
  "Pediatrie",
  "Neurologie",
  "Oftalmologie",
  "Ortopedie",
  "ORL",
  "Medicină internă",
  "Ginecologie",
];

export default function CreateClinic() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name || name.length < 3)
      errs.name = "Numele clinicii trebuie să aibă cel puțin 3 caractere";
    if (!specialty) errs.specialty = "Te rugăm să selectezi o specialitate";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post("/clinics", {
        doctor_id: user!.id,
        name,
        specialty,
      });
      addToast("Clinică creată cu succes!", "success");
      navigate("/my-clinic");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error || "Eșec la crearea clinicii";
        if (err.response?.status === 409) {
          addToast("Ai deja o clinică alocată.", "warning");
          navigate("/my-clinic");
        } else {
          addToast(msg, "error");
        }
      } else {
        addToast("Eșec la crearea clinicii", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container create-clinic-page">
        <div className="create-clinic-card">
          <div className="create-clinic-header">
            <div className="create-clinic-header-icon">🏥</div>
            <h1>Creează Clinica Ta</h1>
            <p>Configurează-ți cabinetul și începe să accepți programări</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="clinic-name">
                Numele Clinicii
              </label>
              <input
                id="clinic-name"
                type="text"
                className={`form-input ${errors.name ? "input-error" : ""}`}
                placeholder="e.g. Cabinet Cardiologie Popescu"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((p) => ({ ...p, name: "" }));
                }}
              />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="clinic-specialty">
                Specialitate
              </label>
              <select
                id="clinic-specialty"
                className={`form-input ${errors.specialty ? "input-error" : ""}`}
                value={specialty}
                onChange={(e) => {
                  setSpecialty(e.target.value);
                  setErrors((p) => ({ ...p, specialty: "" }));
                }}
              >
                <option value="">Selectează o specialitate...</option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.specialty && (
                <div className="form-error">{errors.specialty}</div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : "Creează Clinica"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
