import { Link } from "react-router-dom";
import "./Home.css";
import { useAuth } from "../../context/useAuth";

export default function Home() {
  const auth = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="home-hero">
        <div className="container home-hero-content">
          <h1>
            Sănătatea Ta,
            <br />
            <span>Programul Tău</span>
          </h1>
          <p>
            Programează-te la clinici de încredere în câteva secunde. Disponibilitate în timp real,
            confirmări instantanee și gestionare ușoară — toate într-un singur loc.
          </p>
          <div className="home-hero-actions">
            <Link to="/clinics" className="btn btn-primary btn-lg">
              Caută Clinici
            </Link>
            {auth.isAuthenticated ? (
              <></>
            ) : (
              <Link to="/register" className="btn btn-outline btn-lg">
                Creează Cont
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="home-features">
        <div className="container">
          <div className="home-section-header">
            <h2>De ce să alegi ReserveMD?</h2>
            <p>Un mod mai inteligent de a-ți gestiona programările medicale</p>
          </div>
          <div className="home-features-grid">
            <div className="home-feature-card animate-fade-up stagger-1">
              <div className="home-feature-icon">🏥</div>
              <h3>Găsește Clinici</h3>
              <p>
                Răsfoiește clinici medicale verificate, cu liste detaliate de servicii
                și disponibilitate în timp real.
              </p>
            </div>
            <div className="home-feature-card animate-fade-up stagger-2">
              <div className="home-feature-icon">📅</div>
              <h3>Programează-te Instant</h3>
              <p>
                Alege intervalul orar preferat și obține confirmare instantanee. Fără
                apeluri telefonice necesare.
              </p>
            </div>
            <div className="home-feature-card animate-fade-up stagger-3">
              <div className="home-feature-icon">⚡</div>
              <h3>Gestionează Ușor</h3>
              <p>
                Urmărește-ți toate programările într-un singur loc. Vezi istoricul,
                vizitele viitoare și multe altele.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="home-steps">
        <div className="container">
          <div className="home-section-header">
            <h2>Cum Funcționează</h2>
            <p>Trei pași simpli către următoarea ta programare</p>
          </div>
          <div className="home-steps-grid">
            <div className="home-step animate-fade-up stagger-1">
              <div className="home-step-number">1</div>
              <h3>Caută</h3>
              <p>
                Găsește clinica potrivită după specialitate, locație sau numele medicului
                din directorul nostru.
              </p>
            </div>
            <div className="home-step animate-fade-up stagger-2">
              <div className="home-step-number">2</div>
              <h3>Selectează</h3>
              <p>
                Alege un serviciu și selectează data și intervalul orar preferat din
                calendarul disponibil.
              </p>
            </div>
            <div className="home-step animate-fade-up stagger-3">
              <div className="home-step-number">3</div>
              <h3>Programează-te</h3>
              <p>
                Confirmă-ți programarea și primește verificare instantanee. E atât de simplu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} ReserveMD — Toate drepturile rezervate.</p>
        </div>
      </footer>
    </div>
  );
}
