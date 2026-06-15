import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useClinics } from '../../hooks/useClinics';
import './Navbar.css';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { clinics } = useClinics();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Does the logged-in user own a clinic?
  const userClinic = clinics.find(c => c.doctor_id === user?.id);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    setMobileOpen(false);
    navigate('/');
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <div className="navbar-brand-icon">🩺</div>
          ReserveMD
        </Link>

        {/* Desktop Nav Links */}
        <div className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
            Acasă
          </NavLink>
          <NavLink to="/clinics" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
            Clinici
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/my-reservations" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
              Programările Mele
            </NavLink>
          )}
        </div>

        {/* Desktop Actions */}
        <div className="navbar-actions">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">Autentificare</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Înregistrare</Link>
            </>
          ) : (
            <div className="navbar-user" ref={dropdownRef}>
              <span className="navbar-user-name">{user?.full_name}</span>
              <div className="navbar-avatar" onClick={() => setDropdownOpen(!dropdownOpen)}>
                {getInitials(user?.full_name || 'U')}
              </div>
              {dropdownOpen && (
                <div className="navbar-dropdown">
                  <NavLink to="/my-reservations" className="navbar-dropdown-item" onClick={() => setDropdownOpen(false)}>
                    📅 Programările Mele
                  </NavLink>
                  {userClinic ? (
                    <NavLink to="/my-clinic" className="navbar-dropdown-item" onClick={() => setDropdownOpen(false)}>
                      🏥 Clinica Mea
                    </NavLink>
                  ) : (
                    <NavLink to="/create-clinic" className="navbar-dropdown-item" onClick={() => setDropdownOpen(false)}>
                      ➕ Creează Clinică
                    </NavLink>
                  )}
                  <div className="navbar-dropdown-divider" />
                  <button className="navbar-dropdown-item danger" onClick={handleLogout}>
                    🚪 Deconectare
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hamburger */}
        <button className="navbar-hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="navbar-mobile-menu">
          <NavLink to="/" className="navbar-link" onClick={() => setMobileOpen(false)}>Acasă</NavLink>
          <NavLink to="/clinics" className="navbar-link" onClick={() => setMobileOpen(false)}>Clinici</NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/my-reservations" className="navbar-link" onClick={() => setMobileOpen(false)}>
                Programările Mele
              </NavLink>
              {userClinic ? (
                <NavLink to="/my-clinic" className="navbar-link" onClick={() => setMobileOpen(false)}>
                  Clinica Mea
                </NavLink>
              ) : (
                <NavLink to="/create-clinic" className="navbar-link" onClick={() => setMobileOpen(false)}>
                  Creează Clinică
                </NavLink>
              )}
              <button className="btn btn-danger" onClick={handleLogout}>Deconectare</button>
            </>
          )}
          {!isAuthenticated && (
            <>
              <Link to="/login" className="btn btn-outline" onClick={() => setMobileOpen(false)}>Autentificare</Link>
              <Link to="/register" className="btn btn-primary" onClick={() => setMobileOpen(false)}>Înregistrare</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
