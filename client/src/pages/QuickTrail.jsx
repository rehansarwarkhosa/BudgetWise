import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { IoSend, IoTrash, IoCopy, IoSearch, IoClose } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { useSettings } from '../context/SettingsContext';
import useSwipeTabs from '../hooks/useSwipeTabs';
import { getTrails, createTrail, deleteTrail } from '../api';
import { formatDateTime } from '../utils/format';
import KanbanBoard from './KanbanBoard';

function getEntryHighlight(text, highlights) {
  if (!highlights?.length) return null;
  const lower = text.toLowerCase();
  for (const h of highlights) {
    if (lower.includes(h.keyword.toLowerCase())) return h.color;
  }
  return null;
}

export default function QuickTrail() {
  const { settings } = useSettings();
  const trailBold = settings?.trailBoldText || false;
  const trailHighlights = useMemo(() => settings?.trailHighlights || [], [settings?.trailHighlights]);
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('trail');
  const swipe = useSwipeTabs(['trail', 'board'], activeTab, setActiveTab);
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  const fetchTrails = async (p = 1, append = false, search = searchQuery) => {
    try {
      const res = await getTrails(p, search || undefined);
      const data = res.data;
      setEntries(prev => append ? [...prev, ...data.entries] : data.entries);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    fetchTrails(1, false, '').finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchMode) return;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchTrails(1, false, searchQuery);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  const toggleSearch = () => {
    if (searchMode) {
      setSearchMode(false);
      setSearchQuery('');
      fetchTrails(1, false, '');
    } else {
      setSearchMode(true);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

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
    await fetchTrails(page + 1, true, searchQuery);
    setLoadingMore(false);
  };

  if (loading && activeTab === 'trail') return (
    <div className="page"><h1 className="page-title">Trail</h1><Spinner /></div>
  );

  return (
    <div className="page" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Trail</h1>
        {activeTab === 'trail' && (
          <button className="btn-ghost" onClick={toggleSearch}
            style={{ padding: 6, borderRadius: 8, background: searchMode ? 'var(--bg-input)' : 'transparent' }}>
            {searchMode ? <IoClose size={20} /> : <IoSearch size={20} />}
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'trail', label: 'Trail' }, { key: 'board', label: 'Board' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: activeTab === 'trail' ? 'block' : 'none' }}>
        {/* Search bar */}
        {searchMode && (
          <input ref={searchRef} type="text" placeholder="Search trails..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 12, width: '100%' }} />
        )}

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
          <EmptyState icon={searchMode ? "🔍" : "⚡"} title={searchMode ? "No results" : "No entries yet"} subtitle={searchMode ? `Nothing found for "${searchQuery}"` : "Type something and hit send"} />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {entries.map((entry) => {
              const hlColor = getEntryHighlight(entry.text, trailHighlights);
              return (
              <div key={entry._id} className="card" style={{
                position: 'relative',
                ...(hlColor ? { background: hlColor + '20', borderLeft: `3px solid ${hlColor}` } : {}),
              }}>
                <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap', ...(trailBold ? { fontWeight: 700 } : {}) }}>
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
              );
            })}

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
      <div style={{ display: activeTab === 'board' ? 'block' : 'none' }}>
        <KanbanBoard />
      </div>
    </div>
  );
}
