import { useState, useMemo } from 'react';
import { useClinics } from '../../hooks/useClinics';
import ClinicCard from '../../components/ClinicCard/ClinicCard';
import EmptyState from '../../components/EmptyState';
import './ClinicsList.css';

export default function ClinicsList() {
  const { clinics, loading } = useClinics();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return clinics;
    const q = search.toLowerCase();
    return clinics.filter(
      c => c.name.toLowerCase().includes(q) || c.specialty.toLowerCase().includes(q)
    );
  }, [clinics, search]);

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="clinics-header">
          <h1>Clinicile Noastre</h1>
          <p>Găsește clinica potrivită nevoilor tale</p>
        </div>

        <div className="clinics-search">
          <span className="clinics-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Caută după nume sau specialitate..."
              value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="clinics-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 200 }} />
                <div style={{ padding: 20 }}>
                  <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 28, width: '40%', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🏥"
            title="Nicio clinică găsită"
            description={search ? 'Încearcă un alt termen de căutare.' : 'Nu există clinici înregistrate încă.'}
          />
        ) : (
          <div className="clinics-grid">
            {filtered.map((clinic, i) => (
              <ClinicCard key={clinic.id} clinic={clinic} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
