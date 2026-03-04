import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'var(--modal-backdrop)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, padding: 0,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: '16px 16px 0 0',
        width: '100%', maxWidth: 'var(--max-width)', maxHeight: '85vh',
        overflow: 'auto', padding: '20px 16px', paddingBottom: '32px',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: 'var(--border)', margin: '0 auto 16px',
        }} />
        {title && <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
