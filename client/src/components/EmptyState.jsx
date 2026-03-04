export default function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 20px',
      color: 'var(--text-muted)',
    }}>
      {icon && <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {title}
      </h3>
      {subtitle && <p style={{ fontSize: 13 }}>{subtitle}</p>}
    </div>
  );
}
