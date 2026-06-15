import { format } from "date-fns";
import { useAuth } from "../../context/useAuth";
import { useReservations } from "../../hooks/useReservations";
import { useClinics } from "../../hooks/useClinics";
import { useServices } from "../../hooks/useServices";
import EmptyState from "../../components/EmptyState";
import "./MyReservations.css";

export default function MyReservations() {
  const { user } = useAuth();
  const { reservations, loading } = useReservations({ patientId: user?.id });
  const { clinics } = useClinics();
  const { services } = useServices();

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
        <div className="reservations-header">
          <h1>Programările Mele</h1>
          <p>Vezi și urmărește-ți toate programările</p>
        </div>

        {loading ? (
          <div className="reservations-list">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 88, borderRadius: 12 }}
              />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Nicio programare încă"
            description="Răsfoiește clinicile pentru a face prima ta programare!"
            actionText="Caută Clinici"
            actionTo="/clinics"
          />
        ) : (
          <div className="reservations-list">
            {reservations.map((r, i) => {
              const clinic = clinics.find((c) => c.id === r.clinic_id);
              const service = services.find((s) => s.id === r.service_id);

              return (
                <div
                  key={r.id}
                  className={`reservation-card animate-fade-up stagger-${(i % 10) + 1}`}
                >
                  <div className="reservation-card-icon">🏥</div>
                  <div className="reservation-card-body">
                    <div className="reservation-card-title">
                      {clinic?.name || `Clinica #${r.clinic_id}`}
                    </div>
                    <div className="reservation-card-details">
                      <span className="reservation-card-detail">
                        🩺 {service?.name || `Serviciu #${r.service_id}`}
                      </span>
                      <span className="reservation-card-detail">
                        📆 {format(new Date(r.start_time), "EEEE, MMM d, yyyy")}
                      </span>
                      <span className="reservation-card-detail">
                        ⏰ {format(new Date(r.start_time), "HH:mm")} —{" "}
                        {format(new Date(r.end_time), "HH:mm")}
                      </span>
                    </div>
                  </div>
                  <div className="reservation-card-status">
                    {statusBadge(r.status)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
