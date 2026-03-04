import Modal from './Modal';

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Delete', danger = true }) {
  return (
    <Modal open={open} onClose={onClose} title={title || 'Are you sure?'}>
      {message && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{message}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} style={{ flex: 1 }}
          onClick={() => { onConfirm(); onClose(); }}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
