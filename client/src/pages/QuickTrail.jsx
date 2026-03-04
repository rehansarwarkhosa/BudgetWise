import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { IoSend, IoTrash, IoCopy } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { getTrails, createTrail, deleteTrail } from '../api';
import { formatDateTime } from '../utils/format';

export default function QuickTrail() {
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const inputRef = useRef(null);

  const fetchTrails = async (p = 1, append = false) => {
    try {
      const res = await getTrails(p);
      const data = res.data;
      setEntries(prev => append ? [...prev, ...data.entries] : data.entries);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    fetchTrails(1).finally(() => setLoading(false));
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await createTrail({ text: text.trim() });
      setEntries(prev => [res.data, ...prev]);
      setText('');
      inputRef.current?.focus();
    } catch (err) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTrail(confirmDelete._id);
      setEntries(prev => prev.filter(e => e._id !== confirmDelete._id));
      toast.success('Deleted');
    } catch (err) { toast.error(err.message); }
  };

  const handleCopy = (entry) => {
    const formatted = `${entry.text}\n${formatDateTime(entry.createdAt)}`;
    navigator.clipboard.writeText(formatted);
    toast.success('Copied');
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchTrails(page + 1, true);
    setLoadingMore(false);
  };

  if (loading) return (
    <div className="page"><h1 className="page-title">Trail</h1><Spinner /></div>
  );

  return (
    <div className="page">
      <h1 className="page-title">Trail</h1>

      {/* Input bar */}
      <form onSubmit={handleSend} style={{
        display: 'flex', gap: 8, marginBottom: 16,
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg-page)', paddingBottom: 8,
      }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Quick thought..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1 }}
          autoFocus
        />
        <button type="submit" className="btn-primary"
          disabled={sending || !text.trim()}
          style={{ width: 'auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <IoSend size={18} />
        </button>
      </form>

      {/* Entries */}
      {entries.length === 0 ? (
        <EmptyState icon="⚡" title="No entries yet" subtitle="Type something and hit send" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {entries.map((entry) => (
            <div key={entry._id} className="card" style={{ position: 'relative' }}>
              <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                {entry.text}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatDateTime(entry.createdAt)}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-ghost" style={{ padding: 4 }} onClick={() => handleCopy(entry)}>
                    <IoCopy size={14} color="var(--text-muted)" />
                  </button>
                  <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setConfirmDelete(entry)}>
                    <IoTrash size={14} color="var(--danger)" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {page < totalPages && (
            <button className="btn-outline" onClick={handleLoadMore} disabled={loadingMore}
              style={{ marginTop: 4 }}>
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}

      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete entry?"
        message={`Delete "${confirmDelete?.text?.slice(0, 50)}${confirmDelete?.text?.length > 50 ? '...' : ''}"?`} />
    </div>
  );
}
