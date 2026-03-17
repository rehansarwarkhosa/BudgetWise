import { useState, useRef, useEffect } from 'react';
import Modal from './Modal';

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Delete', danger = true }) {
  const [password, setPassword] = useState('');
  const confirmRef = useRef(null);

  const isValid = password === '0000';

  useEffect(() => {
    if (isValid) confirmRef.current?.focus();
  }, [isValid]);

  const handleClose = () => {
    setPassword('');
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    setPassword('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title || 'Are you sure?'}>
      {message && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{message}</p>}
      <div className="form-group">
        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Enter password <strong>0000</strong> to confirm</label>
        <input type="password" placeholder="Enter 0000" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && isValid) handleConfirm(); }}
          maxLength={4} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-outline" style={{ flex: 1 }} onClick={handleClose}>Cancel</button>
        <button ref={confirmRef} className={danger ? 'btn-danger' : 'btn-primary'} style={{ flex: 1 }}
          disabled={!isValid}
          onClick={handleConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
