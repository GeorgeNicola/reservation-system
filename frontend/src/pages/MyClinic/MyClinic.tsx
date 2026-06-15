import { useState, type FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { useClinics } from "../../hooks/useClinics";
import { useServices } from "../../hooks/useServices";
import { useReservations } from "../../hooks/useReservations";
import Modal from "../../components/Modal/Modal";
import EmptyState from "../../components/EmptyState";
import api from "../../api/axios";
import axios from "axios";
import "./MyClinic.css";

export default function MyClinic() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { clinics, loading: clinicsLoading } = useClinics();

  const myClinic = clinics.find((c) => c.doctor_id === user?.id);

  const {
    services,
    loading: servicesLoading,
    refetch: refetchServices,
  } = useServices(myClinic?.id);
  const { reservations } = useReservations(
    myClinic ? { clinicId: myClinic.id } : undefined,
  );

  const [showAddService, setShowAddService] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    duration_minutes: "",
    description: "",
    price: "",
  });
  const [addingService, setAddingService] = useState(false);

  // Redirect to create clinic if user doesn't own one
  useEffect(() => {
    if (!clinicsLoading && !myClinic) {
      navigate("/create-clinic", { replace: true });
    }
  }, [clinicsLoading, myClinic, navigate]);

  if (clinicsLoading || !myClinic) {
    return (
      <div
        className="page-wrapper"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="spinner spinner-dark"
          style={{ width: 40, height: 40 }}
        />
      </div>
    );
  }

  const handleAddService = async (e: FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name || !serviceForm.duration_minutes) {
      addToast("Numele și durata sunt obligatorii", "error");
      return;
    }

    setAddingService(true);
    try {
      await api.post("/services", {
        clinic_id: myClinic.id,
        name: serviceForm.name,
        duration_minutes: parseInt(serviceForm.duration_minutes),
        description: serviceForm.description || undefined,
        price: serviceForm.price ? parseFloat(serviceForm.price) : undefined,
      });
      addToast("Serviciu adăugat cu succes!", "success");
      setShowAddService(false);
      setServiceForm({
        name: "",
        duration_minutes: "",
        description: "",
        price: "",
      });
      refetchServices();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        addToast(err.response?.data?.error || "Eșec la adăugarea serviciului", "error");
      } else {
        addToast("Eșec la adăugarea serviciului", "error");
      }
    } finally {
      setAddingService(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <span className="badge badge-green">Confirmată</span>;
      case "cancelled":
        return <span className="badge badge-red">Anulată</span>;
      case "completed":
        return <span className="badge badge-blue">Finalizată</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        {/* Overview */}
        <div className="my-clinic-overview">
          <div className="my-clinic-info-card">
            <h1>{myClinic.name}</h1>
            <div className="my-clinic-meta">
              <div className="badge badge-green">{myClinic.specialty}</div>
              <div className="my-clinic-stat">
                {myClinic.is_active ? "🟢" : "⚪"}{" "}
                <strong>{myClinic.is_active ? "Activă" : "Inactivă"}</strong>
              </div>
            </div>
            <div className="my-clinic-stat">
              📅 Creată la {format(new Date(myClinic.created_at), "MMMM d, yyyy")}
            </div>
          </div>

          <div
            className="my-clinic-info-card"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📊</div>
            <div
              className="my-clinic-stat"
              style={{ fontSize: "1rem", marginBottom: 4 }}
            >
              <strong
                style={{ fontSize: "2rem", color: "var(--color-primary)" }}
              >
                {reservations.length}
              </strong>
            </div>
            <div
              style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}
            >
              Total Programări
            </div>
            <div className="my-clinic-stat" style={{ marginTop: 12 }}>
              <strong
                style={{ fontSize: "1.5rem", color: "var(--color-secondary)" }}
              >
                {services.length}
              </strong>
            </div>
            <div
              style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}
            >
              Servicii Active
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="my-clinic-section">
          <div className="my-clinic-section-header">
            <h2>🩺 Servicii</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddService(true)}
            >
              + Adaugă Serviciu
            </button>
          </div>

          {servicesLoading ? (
            <div
              className="skeleton"
              style={{ height: 100, borderRadius: 12 }}
            />
          ) : services.length === 0 ? (
            <EmptyState
              icon="🩺"
              title="Niciun serviciu încă"
              description="Adaugă primul tău serviciu pentru ca pacienții să se poată programa."
            />
          ) : (
            <div className="my-clinic-services-grid">
              {services.map((s) => (
                <div key={s.id} className="my-clinic-service-card">
                  <div className="my-clinic-service-name">{s.name}</div>
                  {s.description && (
                    <p
                      style={{
                        fontSize: "0.813rem",
                        color: "var(--color-text-muted)",
                        marginBottom: 8,
                      }}
                    >
                      {s.description}
                    </p>
                  )}
                  <div className="my-clinic-service-details">
                    <span>⏱️ {s.duration_minutes} min</span>
                    {s.price && (
                      <span>💰 {parseFloat(s.price).toFixed(2)} RON</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reservations */}
        <div className="my-clinic-section">
          <div className="my-clinic-section-header">
            <h2>📅 Programări</h2>
          </div>

          {reservations.length === 0 ? (
            <EmptyState
              icon="📅"
              title="Nicio programare încă"
              description="Odată ce pacienții încep să se programeze, programările lor vor apărea aici."
            />
          ) : (
            <div className="my-clinic-table-wrapper">
              <table className="my-clinic-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Pacient</th>
                    <th>Serviciu</th>
                    <th>Dată & Oră</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => {
                    const svc = services.find((s) => s.id === r.service_id);
                    return (
                      <tr key={r.id}>
                        <td>#{r.id}</td>
                        <td>Pacient #{r.patient_id}</td>
                        <td>{svc?.name || `Serviciu #${r.service_id}`}</td>
                        <td>
                          {format(
                            new Date(r.start_time),
                            "MMM d, yyyy • HH:mm",
                          )}
                        </td>
                        <td>{statusBadge(r.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Service Modal */}
      <Modal
        isOpen={showAddService}
        onClose={() => setShowAddService(false)}
        title="Adaugă un Serviciu Nou"
      >
        <form onSubmit={handleAddService}>
          <div className="form-group">
            <label className="form-label">Numele Serviciului *</label>
            <input
              type="text"
              className="form-input"
              placeholder="ex. Consultație cardiologică"
              value={serviceForm.name}
              onChange={(e) =>
                setServiceForm((p) => ({ ...p, name: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Durată (minute) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="30"
              min="5"
              value={serviceForm.duration_minutes}
              onChange={(e) =>
                setServiceForm((p) => ({
                  ...p,
                  duration_minutes: e.target.value,
                }))
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descriere</label>
            <textarea
              className="form-input"
              placeholder="Descriere opțională..."
              rows={3}
              value={serviceForm.description}
              onChange={(e) =>
                setServiceForm((p) => ({ ...p, description: e.target.value }))
              }
              style={{ resize: "vertical" }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Preț (RON)</label>
            <input
              type="number"
              className="form-input"
              placeholder="150.00"
              step="0.01"
              min="0"
              value={serviceForm.price}
              onChange={(e) =>
                setServiceForm((p) => ({ ...p, price: e.target.value }))
              }
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            disabled={addingService}
          >
            {addingService ? <span className="spinner" /> : "Adaugă Serviciu"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
