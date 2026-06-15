import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionText?: string;
  actionTo?: string;
}

export default function EmptyState({ icon = '📭', title, description, actionText, actionTo }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '64px 24px',
      animation: 'fadeSlideUp 0.5s ease forwards',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: 8 }}>{title}</h3>
      {description && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.938rem', maxWidth: 400, margin: '0 auto 24px' }}>
          {description}
        </p>
      )}
      {actionText && actionTo && (
        <Link to={actionTo} className="btn btn-primary">{actionText}</Link>
      )}
    </div>
  );
}
