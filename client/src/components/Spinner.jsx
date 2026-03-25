export default function Spinner({ size }) {
  if (size) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          width: size, height: size, border: '2px solid var(--border)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', display: 'inline-block',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </span>
    );
  }
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '40px 0',
    }}>
      <div style={{
        width: 36, height: 36, border: '3px solid var(--border)',
        borderTopColor: 'var(--primary)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
