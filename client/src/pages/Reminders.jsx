import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  IoAdd, IoTrash, IoSearch, IoClose, IoCheckmarkCircle,
  IoEllipseOutline, IoChevronDown, IoChevronForward,
  IoAlarm, IoFlag, IoTime, IoCalendar, IoCreate,
  IoLockClosed, IoLockOpen,
} from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { getReminders, createReminder, updateReminder as updateReminderApi, deleteReminder, toggleReminder, getReminderNotes, addReminderNote, updateReminderNote, deleteReminderNote } from '../api';
import { formatDateTime } from '../utils/format';
import RichTextEditor from '../components/RichTextEditor';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SCHEDULE_TYPES = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'custom_days', label: 'Custom Days' },
  { value: 'custom_dates', label: 'Custom Dates' },
  { value: 'interval', label: 'Every N Days' },
];
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#6BCB77' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
];
const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
  { key: 'expired', label: 'Expired' },
];

export default function Reminders() {
  const [allReminders, setAllReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('active');
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const searchRef = useRef(null);

  // Notes state for expanded reminder
  const [reminderNotes, setReminderNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [richEditorOpen, setRichEditorOpen] = useState(false);
  const [richEditorContent, setRichEditorContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [richEditorSaving, setRichEditorSaving] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formType, setFormType] = useState('once');
  const [formTime, setFormTime] = useState('09:00');
  const [formDays, setFormDays] = useState([]);
  const [formDates, setFormDates] = useState([]);
  const [formIntervalDays, setFormIntervalDays] = useState(7);
  const [formIntervalStart, setFormIntervalStart] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await getReminders('all');
      setAllReminders(res.data);
    } catch (err) { toast.error(err.message); }
  }, []);

  useEffect(() => {
    fetchReminders().finally(() => setLoading(false));
  }, []);

  // Client-side filtering — no re-fetch on tab switch
  const reminders = useMemo(() => {
    let filtered = allReminders.filter(r => r.status === statusTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(q) || (r.note || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allReminders, statusTab, searchQuery]);

  const resetForm = () => {
    setFormTitle(''); setFormNote(''); setFormPriority('medium');
    setFormType('once'); setFormTime('09:00'); setFormDays([]);
    setFormDates([]); setFormIntervalDays(7); setFormIntervalStart('');
    setEditingId(null);
  };

  const openForm = (reminder = null) => {
    if (reminder) {
      setEditingId(reminder._id);
      setFormTitle(reminder.title);
      setFormNote(reminder.note || '');
      setFormPriority(reminder.priority || 'medium');
      setFormType(reminder.schedule.type);
      setFormTime(reminder.schedule.time || '09:00');
      setFormDays(reminder.schedule.days || []);
      setFormDates((reminder.schedule.dates || []).map(d => new Date(d).toISOString().split('T')[0]));
      setFormIntervalDays(reminder.schedule.intervalDays || 7);
      setFormIntervalStart(reminder.schedule.intervalStartDate ? new Date(reminder.schedule.intervalStartDate).toISOString().split('T')[0] : '');
    } else {
      resetForm();
    }
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); resetForm(); };

  const handleSave = async () => {
    if (!formTitle.trim()) return toast.error('Title is required');
    if (!formTime) return toast.error('Time is required');
    if (formType === 'custom_days' && formDays.length === 0) return toast.error('Select at least one day');
    if (formType === 'custom_dates' && formDates.length === 0) return toast.error('Add at least one date');
    if (formType === 'interval' && (!formIntervalDays || formIntervalDays < 1)) return toast.error('Interval must be at least 1 day');

    setSaving(true);
    try {
      const schedule = {
        type: formType,
        time: formTime,
        enabled: true,
      };
      if (formType === 'custom_days') schedule.days = formDays;
      if (formType === 'custom_dates') schedule.dates = formDates.map(d => new Date(d));
      if (formType === 'interval') {
        schedule.intervalDays = formIntervalDays;
        schedule.intervalStartDate = formIntervalStart ? new Date(formIntervalStart) : new Date();
      }

      const payload = {
        title: formTitle.trim(),
        note: formNote.trim(),
        priority: formPriority,
        schedule,
      };

      if (editingId) {
        await updateReminderApi(editingId, payload);
        toast.success('Reminder updated');
      } else {
        await createReminder(payload);
        toast.success('Reminder created');
      }
      closeForm();
      fetchReminders();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    const rem = allReminders.find(r => r._id === id);
    if (rem?.locked) return toast.error('This reminder is locked');
    try {
      const res = await toggleReminder(id);
      setAllReminders(prev => prev.map(r => r._id === id ? res.data : r));
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteReminder(confirmDelete);
      setAllReminders(prev => prev.filter(r => r._id !== confirmDelete));
      toast.success('Deleted');
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    setConfirmDelete(null);
  };

  const handleToggleLock = async (id) => {
    const rem = allReminders.find(r => r._id === id);
    if (!rem) return;
    try {
      const res = await updateReminderApi(id, { locked: !rem.locked });
      setAllReminders(prev => prev.map(r => r._id === id ? res.data : r));
      toast.success(rem.locked ? 'Unlocked' : 'Locked');
    } catch (err) { toast.error(err.message); }
  };

  // Load notes when reminder is expanded
  useEffect(() => {
    if (expandedId) {
      setNotesLoading(true);
      getReminderNotes(expandedId).then(res => setReminderNotes(res.data)).catch(() => {}).finally(() => setNotesLoading(false));
    } else {
      setReminderNotes([]);
    }
  }, [expandedId]);

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    setRichEditorContent(note.content);
    setRichEditorOpen(true);
  };

  const handleNewNote = () => {
    setEditingNoteId(null);
    setRichEditorContent('');
    setRichEditorOpen(true);
  };

  const handleSaveNote = async (htmlContent) => {
    setRichEditorSaving(true);
    try {
      if (editingNoteId) {
        const res = await updateReminderNote(editingNoteId, { content: htmlContent });
        setReminderNotes(prev => prev.map(n => n._id === editingNoteId ? res.data : n));
      } else {
        const res = await addReminderNote(expandedId, { content: htmlContent });
        setReminderNotes(prev => [res.data, ...prev]);
      }
      setRichEditorOpen(false);
      setEditingNoteId(null);
    } catch (err) { toast.error(err.message); }
    finally { setRichEditorSaving(false); }
  };

  const handleDeleteNote = async () => {
    if (!confirmDeleteNote) return;
    try {
      await deleteReminderNote(confirmDeleteNote);
      setReminderNotes(prev => prev.filter(n => n._id !== confirmDeleteNote));
      toast.success('Note deleted');
    } catch (err) { toast.error(err.message); }
    setConfirmDeleteNote(null);
  };

  const toggleSearch = () => {
    if (searchMode) {
      setSearchMode(false);
      setSearchQuery('');
    } else {
      setSearchMode(true);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

  const getPriorityColor = (p) => PRIORITY_OPTIONS.find(o => o.value === p)?.color || '#F59E0B';

  const getScheduleLabel = (s) => {
    if (!s) return '';
    switch (s.type) {
      case 'once': return `Once at ${s.time}`;
      case 'daily': return `Daily at ${s.time}`;
      case 'weekdays': return `Weekdays at ${s.time}`;
      case 'custom_days': return `${(s.days || []).map(d => DAY_LABELS[d]).join(', ')} at ${s.time}`;
      case 'custom_dates': return `${(s.dates || []).length} date(s) at ${s.time}`;
      case 'interval': return `Every ${s.intervalDays}d at ${s.time}`;
      default: return s.type;
    }
  };

  // Group reminders by priority for active tab
  const groupedReminders = useMemo(() => {
    if (statusTab !== 'active') return { all: reminders };
    const high = reminders.filter(r => r.priority === 'high');
    const medium = reminders.filter(r => r.priority === 'medium');
    const low = reminders.filter(r => r.priority === 'low');
    const result = {};
    if (high.length) result.high = high;
    if (medium.length) result.medium = medium;
    if (low.length) result.low = low;
    return Object.keys(result).length ? result : { all: reminders };
  }, [reminders, statusTab]);

  const tabCounts = useMemo(() => ({
    active: allReminders.filter(r => r.status === 'active').length,
    completed: allReminders.filter(r => r.status === 'completed').length,
    expired: allReminders.filter(r => r.status === 'expired').length,
  }), [allReminders]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button className="btn-ghost" onClick={toggleSearch}
          style={{ padding: 6, borderRadius: 8, background: searchMode ? 'var(--bg-input)' : 'transparent' }}>
          {searchMode ? <IoClose size={18} /> : <IoSearch size={18} />}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn-primary"
          onClick={() => openForm()}
          style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, width: 'auto' }}>
          <IoAdd size={16} /> New
        </button>
      </div>

      {/* Search bar */}
      {searchMode && (
        <input ref={searchRef} type="text" placeholder="Search reminders..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          style={{ marginBottom: 10, width: '100%' }} />
      )}

      {/* Status sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatusTab(t.key)}
            style={{
              flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
              background: statusTab === t.key ? 'var(--primary)' : 'var(--bg-input)',
              color: statusTab === t.key ? 'white' : 'var(--text-muted)',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
            {t.label}{tabCounts[t.key] > 0 ? ` (${tabCounts[t.key]})` : ''}
          </button>
        ))}
      </div>

      {/* Reminders list */}
      {reminders.length === 0 ? (
        <EmptyState message={statusTab === 'active' ? 'No active reminders' : statusTab === 'completed' ? 'No completed reminders' : 'No expired reminders'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(groupedReminders).map(([group, items]) => (
            <div key={group}>
              {/* Priority group header (only for active tab with multiple groups) */}
              {statusTab === 'active' && group !== 'all' && (
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                  color: getPriorityColor(group), marginBottom: 6, marginTop: group !== 'high' ? 10 : 0,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <IoFlag size={12} /> {group} priority
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>({items.length})</span>
                </div>
              )}

              {items.map(r => (
                <div key={r._id} style={{
                  background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
                  overflow: 'hidden',
                  borderLeft: `3px solid ${getPriorityColor(r.priority)}`,
                  opacity: r.status === 'expired' ? 0.6 : 1,
                }}>
                  {/* Main row */}
                  <div style={{
                    padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                  }}
                    onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}>

                    {/* Toggle circle */}
                    {r.status !== 'expired' && (
                      <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        onClick={e => { e.stopPropagation(); handleToggle(r._id); }}>
                        {r.status === 'completed' ? (
                          <IoCheckmarkCircle size={22} color="var(--success)" />
                        ) : (
                          <IoEllipseOutline size={22} color="var(--text-muted)" />
                        )}
                      </button>
                    )}

                    {/* Lock indicator */}
                    {r.locked && (
                      <IoLockClosed size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 500, color: 'var(--text)',
                        textDecoration: r.status === 'completed' ? 'line-through' : 'none',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IoAlarm size={11} style={{ verticalAlign: -1 }} />
                        {getScheduleLabel(r.schedule)}
                      </div>
                    </div>

                    {/* Expand arrow */}
                    <div style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                      {expandedId === r._id ? <IoChevronDown size={16} /> : <IoChevronForward size={16} />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === r._id && (
                    <div style={{
                      padding: '0 12px 10px', borderTop: '1px solid var(--border)',
                      paddingTop: 10,
                    }}>
                      {/* Note */}
                      {r.note && (
                        <div style={{
                          fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8,
                          padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 8,
                          lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {r.note}
                        </div>
                      )}

                      {/* Meta info */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, fontSize: 11 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 20,
                          background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority),
                          fontWeight: 600,
                        }}>
                          <IoFlag size={10} /> {r.priority}
                        </span>

                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 20,
                          background: 'var(--bg-input)', color: 'var(--text-muted)',
                        }}>
                          <IoCalendar size={10} /> {formatDateTime(r.createdAt)}
                        </span>

                        {r.completedAt && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 20,
                            background: 'var(--success)20', color: 'var(--success)',
                          }}>
                            <IoCheckmarkCircle size={10} /> {formatDateTime(r.completedAt)}
                          </span>
                        )}
                      </div>

                      {/* Schedule details */}
                      {r.schedule.type === 'custom_days' && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                          {DAY_LABELS.map((label, idx) => (
                            <span key={idx} style={{
                              width: 26, height: 26, borderRadius: '50%', fontSize: 11, fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: (r.schedule.days || []).includes(idx) ? 'var(--primary)' : 'var(--bg-input)',
                              color: (r.schedule.days || []).includes(idx) ? 'white' : 'var(--text-muted)',
                            }}>
                              {label}
                            </span>
                          ))}
                        </div>
                      )}

                      {r.schedule.type === 'custom_dates' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {(r.schedule.dates || []).map((d, i) => {
                            const ds = new Date(d).toISOString().split('T')[0];
                            const isPast = new Date(d) < new Date();
                            return (
                              <span key={i} style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 10,
                                background: isPast ? 'var(--bg-input)' : 'var(--primary)',
                                color: isPast ? 'var(--text-muted)' : 'white',
                                textDecoration: isPast ? 'line-through' : 'none',
                              }}>
                                {ds}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Notes section */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Notes {reminderNotes.length > 0 && `(${reminderNotes.length})`}
                          </span>
                          {!r.locked && (
                            <button className="btn-ghost" onClick={handleNewNote}
                              style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <IoAdd size={12} /> Add Note
                            </button>
                          )}
                        </div>
                        {notesLoading ? (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>Loading...</div>
                        ) : reminderNotes.length === 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>No notes</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 6 }}>
                            {reminderNotes.map(note => (
                              <div key={note._id} className="card" style={{ padding: 8, cursor: r.locked ? 'default' : 'pointer' }}
                                onClick={() => !r.locked && handleEditNote(note)}>
                                <div dangerouslySetInnerHTML={{ __html: note.content }}
                                  style={{ fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(note.createdAt)}</span>
                                  {!r.locked && (
                                    <button className="btn-ghost" style={{ padding: 2 }} onClick={e => { e.stopPropagation(); setConfirmDeleteNote(note._id); }}>
                                      <IoTrash size={12} color="var(--danger)" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" onClick={() => handleToggleLock(r._id)}
                          style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {r.locked ? <IoLockClosed size={14} color="var(--warning)" /> : <IoLockOpen size={14} color="var(--text-muted)" />}
                          {r.locked ? 'Unlock' : 'Lock'}
                        </button>
                        {r.status !== 'expired' && !r.locked && (
                          <button className="btn-ghost" onClick={() => openForm(r)}
                            style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <IoCreate size={14} color="var(--primary)" /> Edit
                          </button>
                        )}
                        {!r.locked && (
                          <button className="btn-ghost" onClick={() => setConfirmDelete(r._id)}
                            style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <IoTrash size={14} color="var(--danger)" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={closeForm}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px 16px 0 0',
            padding: 20, width: '100%', maxWidth: 'var(--max-width)',
            maxHeight: '85vh', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 36, height: 4, borderRadius: 2, background: 'var(--border)',
              margin: '0 auto 16px',
            }} />

            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
              {editingId ? 'Edit Reminder' : 'New Reminder'}
            </div>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Title *
              </label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g., Baby vaccination, Birthday reminder..."
                style={{ width: '100%' }} autoFocus />
            </div>

            {/* Note */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Note
              </label>
              <textarea value={formNote} onChange={e => setFormNote(e.target.value)}
                placeholder="Additional details, instructions, or context..."
                rows={3}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                Priority
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITY_OPTIONS.map(p => (
                  <button key={p.value} type="button" onClick={() => setFormPriority(p.value)}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600,
                      background: formPriority === p.value ? p.color + '20' : 'var(--bg-input)',
                      color: formPriority === p.value ? p.color : 'var(--text-muted)',
                      border: formPriority === p.value ? `1.5px solid ${p.color}` : '1.5px solid transparent',
                      borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                Schedule
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {SCHEDULE_TYPES.map(s => (
                  <button key={s.value} type="button" onClick={() => setFormType(s.value)}
                    style={{
                      padding: '8px 4px', fontSize: 11, fontWeight: 600,
                      background: formType === s.value ? 'var(--primary)' : 'var(--bg-input)',
                      color: formType === s.value ? 'white' : 'var(--text-muted)',
                      border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                <IoTime size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                Time
              </label>
              <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                style={{ width: '100%' }} />
            </div>

            {/* Custom Days */}
            {formType === 'custom_days' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Days
                </label>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {DAY_LABELS.map((label, idx) => (
                    <button key={idx} type="button"
                      onClick={() => {
                        setFormDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
                      }}
                      style={{
                        width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600,
                        background: formDays.includes(idx) ? 'var(--primary)' : 'var(--bg-input)',
                        color: formDays.includes(idx) ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Dates */}
            {formType === 'custom_dates' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Dates
                </label>
                <input type="date"
                  onChange={e => {
                    if (!e.target.value) return;
                    if (!formDates.includes(e.target.value)) {
                      setFormDates(prev => [...prev, e.target.value]);
                    }
                    e.target.value = '';
                  }}
                  style={{ width: '100%', marginBottom: 8 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {formDates.map((d, i) => (
                    <span key={i} style={{
                      fontSize: 12, padding: '4px 10px', borderRadius: 20,
                      background: 'var(--primary)', color: 'white',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {d}
                      <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                        onClick={() => setFormDates(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interval */}
            {formType === 'interval' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Repeat every
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min="1" value={formIntervalDays}
                    onChange={e => setFormIntervalDays(parseInt(e.target.value) || 1)}
                    style={{ width: 70, textAlign: 'center' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>days</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Starting from
                  </label>
                  <input type="date" value={formIntervalStart}
                    onChange={e => setFormIntervalStart(e.target.value)}
                    style={{ width: '100%' }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-ghost" onClick={closeForm}
                style={{ flex: 1, padding: '12px 0', fontSize: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '12px 0', fontSize: 14, borderRadius: 10 }}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Reminder?"
        message="Delete this reminder? This cannot be undone."
      />

      {/* Confirm Delete Note */}
      <ConfirmModal
        open={!!confirmDeleteNote}
        onClose={() => setConfirmDeleteNote(null)}
        onConfirm={handleDeleteNote}
        title="Delete Note?"
        message="Delete this note? This cannot be undone."
      />

      {/* Rich Text Editor for Notes */}
      <RichTextEditor
        open={richEditorOpen}
        initialContent={richEditorContent}
        onSave={handleSaveNote}
        onClose={() => { setRichEditorOpen(false); setEditingNoteId(null); }}
        title={editingNoteId ? 'Edit Note' : 'New Note'}
        saving={richEditorSaving}
      />
    </div>
  );
}
