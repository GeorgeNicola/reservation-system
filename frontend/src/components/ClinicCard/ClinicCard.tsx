import { useNavigate } from 'react-router-dom';
import type { Clinic } from '../../types';
import './ClinicCard.css';

const CLINIC_IMAGES = [
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop',
];

interface ClinicCardProps {
  clinic: Clinic;
  index?: number;
}

export default function ClinicCard({ clinic, index = 0 }: ClinicCardProps) {
  const navigate = useNavigate();
  const imgSrc = CLINIC_IMAGES[clinic.id % CLINIC_IMAGES.length];

  return (
    <div
      className={`clinic-card animate-fade-up stagger-${(index % 10) + 1}`}
      onClick={() => navigate(`/clinics/${clinic.id}`)}
    >
      <img
        className="clinic-card-image"
        src={imgSrc}
        alt={clinic.name}
        loading="lazy"
      />
      <div className="clinic-card-body">
        <h3 className="clinic-card-name">{clinic.name}</h3>
        <div className="clinic-card-specialty">{clinic.specialty}</div>
        <div className="clinic-card-footer">
          <span className="clinic-card-link">
            View Clinic →
          </span>
          <span className="clinic-card-status">
            {clinic.is_active ? '🟢 Active' : '⚪ Inactive'}
          </span>
        </div>
      </div>
    </div>
  );
}
