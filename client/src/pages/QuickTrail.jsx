import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { IoSend, IoTrash, IoCopy, IoSearch, IoClose, IoAlarm, IoFilter, IoDocumentText, IoAdd, IoColorPalette, IoSave } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { useSettings } from '../context/SettingsContext';
import useSwipeTabs from '../hooks/useSwipeTabs';
import useMenuSwipe from '../hooks/useMenuSwipe';
import { getTrails, createTrail, updateTrail, deleteTrail, getTrailNotes, addTrailNote, updateTrailNote, deleteTrailNote } from '../api';
import { formatDateTime } from '../utils/format';
import KanbanBoard from './KanbanBoard';

const RICH_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', '#1A1A2E', '#F1F1F6'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

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
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'with_reminders', 'plain'
  const [showFilter, setShowFilter] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);
  const [activeTab, setActiveTab] = useState('trail');
  const onOverflow = useMenuSwipe();
  const swipe = useSwipeTabs(['trail', 'board'], activeTab, setActiveTab, onOverflow);
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);
  const lastTapRef = useRef({});

  const fetchTrails = async (p = 1, append = false, search = searchQuery, filter = filterMode) => {
    try {
      const res = await getTrails(p, search || undefined, filter);
      const data = res.data;
      setEntries(prev => append ? [...prev, ...data.entries] : data.entries);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    fetchTrails(1, false, '', 'all').finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchMode) return;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchTrails(1, false, searchQuery, filterMode);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  const handleFilterChange = (f) => {
    setFilterMode(f);
    setShowFilter(false);
    fetchTrails(1, false, searchQuery, f);
  };

  const toggleSearch = () => {
    if (searchMode) {
      setSearchMode(false);
      setSearchQuery('');
      fetchTrails(1, false, '', filterMode);
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
    await fetchTrails(page + 1, true, searchQuery, filterMode);
    setLoadingMore(false);
  };

  const handleDoubleTap = (entry) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[entry._id] || 0;
    lastTapRef.current[entry._id] = now;
    if (now - lastTap < 350) {
      lastTapRef.current[entry._id] = 0;
      setDetailEntry(entry);
    }
  };

  const handleEntryUpdated = (updated) => {
    setEntries(prev => prev.map(e => e._id === updated._id ? updated : e));
  };

  if (loading && activeTab === 'trail') return (
    <div className="page"><h1 className="page-title">Trail</h1><Spinner /></div>
  );

  return (
    <div className="page" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Trail</h1>
        {activeTab === 'trail' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" onClick={() => setShowFilter(!showFilter)}
                style={{ padding: 6, borderRadius: 8, background: filterMode !== 'all' ? 'var(--bg-input)' : 'transparent' }}>
                <IoFilter size={18} color={filterMode !== 'all' ? 'var(--primary)' : undefined} />
              </button>
              {showFilter && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 20,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 4, minWidth: 150, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                  {[
                    { key: 'all', label: 'All Items' },
                    { key: 'with_reminders', label: 'With Reminders' },
                    { key: 'plain', label: 'Plain Items' },
                  ].map(f => (
                    <button key={f.key} onClick={() => handleFilterChange(f.key)}
                      style={{
                        display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                        background: filterMode === f.key ? 'var(--primary)' : 'transparent',
                        color: filterMode === f.key ? 'white' : 'var(--text-primary)',
                        fontSize: 13, textAlign: 'left', cursor: 'pointer', borderRadius: 6,
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-ghost" onClick={toggleSearch}
              style={{ padding: 6, borderRadius: 8, background: searchMode ? 'var(--bg-input)' : 'transparent' }}>
              {searchMode ? <IoClose size={20} /> : <IoSearch size={20} />}
            </button>
          </div>
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
              const hasReminders = entry.reminders?.length > 0;
              return (
              <div key={entry._id} className="card" style={{
                position: 'relative',
                ...(hlColor ? { background: hlColor + '20', borderLeft: `3px solid ${hlColor}` } : {}),
              }}
                onClick={() => handleDoubleTap(entry)}
              >
                <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap', ...(trailBold ? { fontWeight: 700 } : {}) }}>
                  {entry.text}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {hasReminders && (
                      <IoAlarm size={12} color="var(--primary)" title="Has reminders" />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setDetailEntry(entry); }}>
                      <IoDocumentText size={14} color="var(--text-muted)" />
                    </button>
                    <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); handleCopy(entry); }}>
                      <IoCopy size={14} color="var(--text-muted)" />
                    </button>
                    <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setConfirmDelete(entry); }}>
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

      {detailEntry && (
        <TrailDetailModal
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onUpdated={handleEntryUpdated}
        />
      )}
    </div>
  );
}

// ─── Trail Detail Modal ───

const modalBackdrop = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', zIndex: 100,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const modalContent = {
  background: 'var(--bg-card)', borderRadius: '16px 16px 0 0',
  padding: 20, width: '100%', maxWidth: 'var(--max-width)',
};

function TrailDetailModal({ entry, onClose, onUpdated }) {
  const [tab, setTab] = useState('notes');
  const detailSwipe = useSwipeTabs(['notes', 'reminders'], tab, setTab);

  // Notes
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const noteEditorRef = useRef(null);

  // Reminders
  const [reminders, setReminders] = useState(entry.reminders || []);
  const [remindersDirty, setRemindersDirty] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);

  useEffect(() => {
    loadNotes();
    setReminders(entry.reminders || []);
  }, [entry._id]);

  const loadNotes = async () => {
    try {
      const res = await getTrailNotes(entry._id);
      setNotes(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setNotesLoading(false); }
  };

  // Notes handlers
  const execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val);
    noteEditorRef.current?.focus();
  };

  const handleAddNote = async () => {
    const content = noteEditorRef.current?.innerHTML;
    if (!content?.trim() || !stripHtml(content).trim()) return;
    try {
      if (editingNoteId) {
        await updateTrailNote(editingNoteId, { content });
        setEditingNoteId(null);
        toast.success('Note updated');
      } else {
        await addTrailNote(entry._id, { content });
        toast.success('Note added');
      }
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = '';
      loadNotes();
    } catch (err) { toast.error(err.message); }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    if (noteEditorRef.current) noteEditorRef.current.innerHTML = note.content;
    setTab('notes');
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteTrailNote(noteId);
      setNotes(prev => prev.filter(n => n._id !== noteId));
      toast.success('Note deleted');
    } catch (err) { toast.error(err.message); }
  };

  // Reminder handlers
  const addReminder = () => {
    setReminders(prev => [...prev, { type: 'daily', time: '09:00', days: [], dates: [], enabled: true }]);
    setRemindersDirty(true);
  };

  const updateReminder = (idx, field, value) => {
    setReminders(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setRemindersDirty(true);
  };

  const removeReminder = (idx) => {
    setReminders(prev => prev.filter((_, i) => i !== idx));
    setRemindersDirty(true);
  };

  const saveReminders = async () => {
    setSavingReminders(true);
    try {
      const res = await updateTrail(entry._id, { reminders });
      onUpdated(res.data);
      setRemindersDirty(false);
      toast.success('Reminders saved');
    } catch (err) { toast.error(err.message); }
    finally { setSavingReminders(false); }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={{ ...modalContent, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}
        onTouchStart={detailSwipe.onTouchStart} onTouchEnd={detailSwipe.onTouchEnd}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
              {entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text}
            </p>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(entry.createdAt)}</span>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><IoClose size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
          {[{ key: 'notes', label: 'Notes' }, { key: 'reminders', label: 'Reminders' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              }}>
              {t.label}
              {t.key === 'reminders' && reminders.length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--primary)' }}>({reminders.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Notes Tab */}
        <div style={{ display: tab === 'notes' ? 'block' : 'none' }}>
          {/* Rich Text Toolbar */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap',
            padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 8,
          }}>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontWeight: 700, fontSize: 14 }}
              onClick={() => execCmd('bold')}>B</button>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontStyle: 'italic', fontSize: 14 }}
              onClick={() => execCmd('italic')}>I</button>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', textDecoration: 'underline', fontSize: 14 }}
              onClick={() => execCmd('underline')}>U</button>
            <div style={{ position: 'relative' }}>
              <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }}
                onClick={() => setShowColorPicker(!showColorPicker)}>
                <IoColorPalette size={16} />
              </button>
              {showColorPicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 10,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 8, display: 'flex', gap: 4, flexWrap: 'wrap', width: 140,
                }}>
                  {RICH_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => { execCmd('foreColor', c); setShowColorPicker(false); }}
                      style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', background: c, cursor: 'pointer' }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content Editable */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div ref={noteEditorRef} contentEditable suppressContentEditableWarning
              style={{
                flex: 1, minHeight: 50, padding: 10, background: 'var(--bg-input)', borderRadius: 8,
                color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5,
                outline: 'none', overflowY: 'auto', maxHeight: 120,
              }}
              data-placeholder="Add a note..." />
            <button className="btn-primary" onClick={handleAddNote}
              style={{ width: 'auto', padding: '10px 14px', alignSelf: 'flex-end' }}>
              {editingNoteId ? <IoSave size={16} /> : <IoAdd size={16} />}
            </button>
          </div>

          {/* Notes list */}
          {notesLoading ? <Spinner /> : notes.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No notes yet</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {notes.map(note => (
                <div key={note._id} style={{
                  padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8,
                }}>
                  <div dangerouslySetInnerHTML={{ __html: note.content }}
                    style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, wordBreak: 'break-word' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(note.createdAt)}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: 3 }} onClick={() => handleEditNote(note)}>
                        <IoDocumentText size={12} color="var(--primary)" />
                      </button>
                      <button className="btn-ghost" style={{ padding: 3 }} onClick={() => handleDeleteNote(note._id)}>
                        <IoTrash size={12} color="var(--danger)" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reminders Tab */}
        <div style={{ display: tab === 'reminders' ? 'block' : 'none' }}>
          {reminders.map((r, idx) => (
            <ReminderRow key={idx} reminder={r} idx={idx}
              onUpdate={updateReminder} onRemove={removeReminder} />
          ))}

          <button className="btn-ghost" onClick={addReminder}
            style={{ color: 'var(--primary)', fontSize: 13, marginBottom: 12 }}>
            <IoAdd size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Add Reminder
          </button>

          {remindersDirty && (
            <button className="btn-primary" style={{ width: '100%', fontSize: 13 }}
              onClick={saveReminders} disabled={savingReminders}>
              {savingReminders ? 'Saving...' : 'Save Reminders'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reminder Row (shared pattern with kanban/routines + once option) ───

function ReminderRow({ reminder, idx, onUpdate, onRemove }) {
  return (
    <div style={{
      background: 'var(--bg-input)', borderRadius: 8, padding: 10, marginBottom: 8,
      opacity: reminder.enabled ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={reminder.enabled}
            onChange={e => onUpdate(idx, 'enabled', e.target.checked)}
            style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>On</span>
        </label>
        <select value={reminder.type}
          onChange={e => onUpdate(idx, 'type', e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}>
          <option value="once">Once</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="custom_days">Custom Days</option>
          <option value="custom_dates">Custom Dates</option>
        </select>
        <input type="time" value={reminder.time}
          onChange={e => onUpdate(idx, 'time', e.target.value)}
          style={{ fontSize: 12, padding: '4px 6px' }} />
        <button className="btn-ghost" style={{ padding: 4 }} onClick={() => onRemove(idx)}>
          <IoTrash size={14} color="var(--danger)" />
        </button>
      </div>

      {reminder.type === 'once' && reminder.fired && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>
          Already fired
        </div>
      )}

      {reminder.type === 'custom_days' && (
        <div style={{ display: 'flex', gap: 4 }}>
          {DAY_LABELS.map((label, dayIdx) => (
            <button key={dayIdx} type="button"
              onClick={() => {
                const days = reminder.days || [];
                const newDays = days.includes(dayIdx) ? days.filter(d => d !== dayIdx) : [...days, dayIdx];
                onUpdate(idx, 'days', newDays);
              }}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                background: (reminder.days || []).includes(dayIdx) ? 'var(--primary)' : 'var(--bg-card)',
                color: (reminder.days || []).includes(dayIdx) ? 'white' : 'var(--text-muted)',
              }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {reminder.type === 'custom_dates' && (
        <div>
          <input type="date"
            onChange={e => {
              if (!e.target.value) return;
              const dates = reminder.dates || [];
              const newDate = new Date(e.target.value);
              if (!dates.some(d => new Date(d).toISOString().split('T')[0] === e.target.value)) {
                onUpdate(idx, 'dates', [...dates, newDate]);
              }
              e.target.value = '';
            }}
            style={{ fontSize: 12, padding: '4px 6px', marginBottom: 4 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {(reminder.dates || []).map((d, dIdx) => {
              const ds = new Date(d).toISOString().split('T')[0];
              return (
                <span key={dIdx} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--primary)', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {ds}
                  <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: 13 }}
                    onClick={() => onUpdate(idx, 'dates', (reminder.dates || []).filter((_, i) => i !== dIdx))}>×</button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
