import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { useServices } from "../../hooks/useServices";
import { useReservations } from "../../hooks/useReservations";
import { useClinics } from "../../hooks/useClinics";
import Calendar from "../../components/Calendar/Calendar";
import TimeSlots from "../../components/TimeSlots/TimeSlots";
import Modal from "../../components/Modal/Modal";
import api from "../../api/axios";
import axios from "axios";
import type { Service } from "../../types";
import "./ClinicDetail.css";

export default function ClinicDetail() {
  const { id } = useParams<{ id: string }>();
  const clinicId = Number(id);
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const { clinics } = useClinics();
  const { services, loading: servicesLoading } = useServices(clinicId);
  const { reservations, refetch: refetchReservations } = useReservations({
    clinicId,
  });

  const clinic = clinics.find((c) => c.id === clinicId);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    start_time: string;
    end_time: string;
  } | null>(null);

  const handleBook = async () => {
    if (!selectedService || !selectedTime || !user) return;

    setBooking(true);
    try {
      const res = await api.post("/reservations/pessimistic", {
        clinic_id: clinicId,
        patient_id: user.id,
        service_id: selectedService.id,
        start_time: selectedTime,
      });
      setBookingResult(res.data);
      setShowSuccess(true);
      refetchReservations();
      addToast("Programare realizată cu succes!", "success");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg =
          err.response?.data?.error || "Programarea a eșuat. Te rugăm să încerci din nou.";
        addToast(msg, "error");
      } else {
        addToast("Programarea a eșuat. Te rugăm să încerci din nou.", "error");
      }
    } finally {
      setBooking(false);
    }
  };

  const closeSuccess = () => {
    setShowSuccess(false);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const isReady = selectedService && selectedDate && selectedTime;

  return (
    <div className="page-wrapper">
      <div className="container clinic-detail">
        {/* Header */}
        <div className="clinic-detail-header">
          <h1>{clinic?.name || "Clinică"}</h1>
          {clinic && (
            <div className="badge badge-green">{clinic.specialty}</div>
          )}
        </div>

        <div className="clinic-detail-layout">
          {/* Left: Services */}
          <div className="clinic-services-section">
            <h2>Selectează un Serviciu</h2>
            {servicesLoading ? (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 80, marginBottom: 12, borderRadius: 12 }}
                />
              ))
            ) : services.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                Niciun serviciu disponibil pentru această clinică.
              </p>
            ) : (
              services.map((service) => (
                <div
                  key={service.id}
                  className={`clinic-service-item ${selectedService?.id === service.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedService(service);
                    setSelectedTime(null);
                  }}
                >
                  <div className="clinic-service-info">
                    <h3>{service.name}</h3>
                    {service.description && <p>{service.description}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div className="clinic-service-meta">
                      {service.price && (
                        <div className="clinic-service-price">
                          {parseFloat(service.price).toFixed(2)} RON
                        </div>
                      )}
                      <div className="clinic-service-duration">
                        {service.duration_minutes} min
                      </div>
                    </div>
                    {selectedService?.id === service.id && (
                      <span className="clinic-service-check">✓</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Booking */}
          <div className="clinic-booking-section">
            <div className="clinic-booking-card">
              <h2>📅 Programează-te</h2>

              {!selectedService ? (
                <div className="clinic-booking-prompt">
                  ← Selectează un serviciu pentru a continua
                </div>
              ) : (
                <>
                  <Calendar
                    selected={selectedDate}
                    onSelect={(d) => {
                      setSelectedDate(d);
                      setSelectedTime(null);
                    }}
                  />

                  {selectedDate && (
                    <>
                      <div className="clinic-booking-divider" />
                      <TimeSlots
                        date={selectedDate}
                        durationMinutes={selectedService.duration_minutes}
                        selectedTime={selectedTime}
                        onSelect={setSelectedTime}
                        existingReservations={reservations}
                        clinicId={clinicId}
                      />
                    </>
                  )}

                  {isReady && (
                    <>
                      <div className="clinic-booking-divider" />
                      <div className="clinic-booking-summary">
                        <div className="clinic-booking-summary-item">
                          🩺 <span>{selectedService.name}</span>
                        </div>
                        <div className="clinic-booking-summary-item">
                          📆{" "}
                          <span>
                            {format(selectedDate!, "EEEE, MMMM d, yyyy")}
                          </span>
                        </div>
                        <div className="clinic-booking-summary-item">
                          ⏰{" "}
                          <span>
                            {format(new Date(selectedTime!), "HH:mm")}
                          </span>
                        </div>
                      </div>

                      {!isAuthenticated ? (
                        <div className="clinic-booking-login">
                          <p>Trebuie să te autentifici pentru a te programa</p>
                          <Link
                            to="/login"
                            state={{
                              from: { pathname: `/clinics/${clinicId}` },
                            }}
                            className="btn btn-primary"
                          >
                            Autentifică-te pentru a te Programa
                          </Link>
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary btn-lg"
                          style={{ width: "100%" }}
                          onClick={handleBook}
                          disabled={booking}
                        >
                          {booking ? (
                            <span className="spinner" />
                          ) : (
                            "Confirmă Programarea"
                          )}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccess}
        onClose={closeSuccess}
        title="Programare Confirmată!"
      >
        <div className="booking-success">
          <div className="booking-success-icon">✅</div>
          <h3>Totul este Gata!</h3>
          <p>Programarea ta a fost confirmată cu succes.</p>
          {bookingResult && (
            <div className="booking-success-details">
              <div className="booking-success-detail">
                <span>Serviciu</span>
                <strong>{selectedService?.name}</strong>
              </div>
              <div className="booking-success-detail">
                <span>Dată</span>
                <strong>
                  {format(new Date(bookingResult.start_time), "MMM d, yyyy")}
                </strong>
              </div>
              <div className="booking-success-detail">
                <span>Oră</span>
                <strong>
                  {format(new Date(bookingResult.start_time), "HH:mm")} —{" "}
                  {format(new Date(bookingResult.end_time), "HH:mm")}
                </strong>
              </div>
            </div>
          )}
          <Link
            to="/my-reservations"
            className="btn btn-primary"
            onClick={closeSuccess}
          >
            Vezi Programările Mele
          </Link>
        </div>
      </Modal>
    </div>
  );
}
