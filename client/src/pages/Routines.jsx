import { useState } from 'react';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoCheckmarkCircle, IoCloseCircle, IoChevronForward, IoCreate, IoCopy } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import useFetch from '../hooks/useFetch';
import { formatDateTime } from '../utils/format';
import {
  getRoutines, createRoutine, deleteRoutine, updateRoutine,
  getRoutineEntries, logRoutineEntry, deleteRoutineEntry,
} from '../api';

export default function Routines() {
  const { data: routines, loading, refetch } = useFetch(getRoutines);
  const [createModal, setCreateModal] = useState(false);
  const [detailRoutine, setDetailRoutine] = useState(null);
  const [cloneSource, setCloneSource] = useState(null);

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <h1 className="page-title">Routines</h1>

      {routines?.length === 0 ? (
        <EmptyState icon="📋" title="No routines yet" subtitle="Create a routine to track recurring tasks" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {routines?.map((r) => (
            <div key={r._id} className="card" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setDetailRoutine(r)}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.entryCount} entr{r.entryCount !== 1 ? 'ies' : 'y'}
                  {r.lastEntry && <> &middot; Last: {formatDateTime(r.lastEntry.date)}</>}
                </p>
                {r.dueDate && (
                  <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>
                    Due: {new Date(r.dueDate).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                  </p>
                )}
              </div>
              <IoChevronForward size={18} color="var(--text-muted)" />
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setCreateModal(true)}><IoAdd /></button>

      <CreateRoutineModal open={createModal} onClose={() => setCreateModal(false)} onDone={refetch}
        cloneSource={cloneSource} onCloneUsed={() => setCloneSource(null)} />
      <RoutineDetailModal open={!!detailRoutine} routine={detailRoutine}
        onClose={() => setDetailRoutine(null)} onDone={refetch}
        onClone={(r) => { setCloneSource(r); setDetailRoutine(null); setCreateModal(true); }} />
    </div>
  );
}

function CreateRoutineModal({ open, onClose, onDone, cloneSource, onCloneUsed }) {
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize from clone source
  if (open && cloneSource && !initialized) {
    setName(cloneSource.name + ' (Copy)');
    setDueDate(cloneSource.dueDate ? cloneSource.dueDate.split('T')[0] : '');
    setFields(cloneSource.fields?.map(f => ({ label: f.label, type: f.type, options: [...(f.options || [])] })) || []);
    setInitialized(true);
    onCloneUsed?.();
  }

  if (open && !cloneSource && !initialized) {
    setInitialized(true);
  }

  if (!open && initialized) {
    // Reset on close (will trigger on next render cycle)
    setTimeout(() => { setName(''); setDueDate(''); setFields([]); setInitialized(false); }, 0);
  }

  const addField = () => {
    setFields([...fields, { label: '', type: 'text', options: [] }]);
  };

  const updateField = (idx, key, val) => {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], [key]: val };
    setFields(updated);
  };

  const removeField = (idx) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const hasOptions = (t) => t === 'radio' || t === 'checkbox';
      const validFields = fields.filter((f) => f.label.trim());
      await createRoutine({
        name,
        dueDate: dueDate || null,
        fields: validFields.map((f) => ({
          ...f,
          options: hasOptions(f.type) ? f.options.filter((o) => o.trim()) : [],
        })),
      });
      toast.success('Routine created');
      setName(''); setDueDate(''); setFields([]); setInitialized(false);
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={cloneSource ? 'Clone Routine' : 'Create Routine'}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Routine Name</label>
          <input type="text" placeholder="e.g., Morning Workout" value={name}
            onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Due Date (optional)</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Fields</label>
            <button type="button" className="btn-ghost" onClick={addField}
              style={{ color: 'var(--primary)', fontSize: 13 }}>+ Add Field</button>
          </div>
          {fields.map((field, idx) => (
            <div key={idx} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="text" placeholder="Field label" value={field.label}
                  onChange={(e) => updateField(idx, 'label', e.target.value)}
                  style={{ flex: 1 }} />
                <select value={field.type} onChange={(e) => updateField(idx, 'type', e.target.value)}
                  style={{ width: 'auto', flex: '0 0 110px' }}>
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="time">Time</option>
                  <option value="rating">Rating</option>
                  <option value="radio">Radio</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <button type="button" className="btn-ghost" onClick={() => removeField(idx)}
                  style={{ color: 'var(--danger)', padding: 4 }}><IoTrash size={16} /></button>
              </div>
              {(field.type === 'radio' || field.type === 'checkbox') && (
                <div>
                  <input type="text" placeholder="Options (comma-separated)"
                    value={field.options.join(', ')}
                    onChange={(e) => updateField(idx, 'options', e.target.value.split(',').map((s) => s.trim()))}
                    style={{ fontSize: 13 }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating...' : cloneSource ? 'Clone Routine' : 'Create Routine'}
        </button>
      </form>
    </Modal>
  );
}

function RoutineDetailModal({ open, routine, onClose, onDone, onClone }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const fetchEntries = async () => {
    if (!routine?._id) return;
    setLoading(true);
    try {
      const res = await getRoutineEntries(routine._id);
      setEntries(res.data);
      setFetched(true);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  if (open && routine?._id && !fetched && !loading) {
    fetchEntries();
  }

  const handleClose = () => {
    setEntries([]); setFetched(false); setEditing(false);
    onClose();
  };

  const handleDelete = async () => {
    try {
      await deleteRoutine(routine._id);
      toast.success('Routine deleted');
      handleClose(); onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteEntry = async () => {
    if (!confirmDeleteEntry) return;
    try {
      await deleteRoutineEntry(confirmDeleteEntry._id);
      toast.success('Entry deleted');
      setConfirmDeleteEntry(null);
      fetchEntries();
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveEdit = async () => {
    try {
      await updateRoutine(routine._id, { name: editName, dueDate: editDueDate || null });
      toast.success('Routine updated');
      setEditing(false);
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  // Compute stats
  const completedCount = entries.filter(e => e.status === 'complete').length;
  const completionRate = entries.length > 0 ? Math.round((completedCount / entries.length) * 100) : 0;

  // Streak: consecutive complete entries from most recent
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  // entries are sorted newest first
  for (const entry of entries) {
    if (entry.status === 'complete') {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }
  // Current streak from newest
  for (const entry of entries) {
    if (entry.status === 'complete') currentStreak++;
    else break;
  }

  return (
    <Modal open={open} onClose={handleClose} title={routine?.name}>
      {/* Stats bar */}
      {fetched && entries.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16,
          padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8,
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{completionRate}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Completion</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{currentStreak}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current Streak</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{longestStreak}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Best Streak</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{entries.length}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => setLogModal(true)}>
          Log Entry
        </button>
        <button className="btn-outline" style={{ width: 'auto', padding: '12px 14px' }}
          onClick={() => { setEditing(true); setEditName(routine?.name || ''); setEditDueDate(routine?.dueDate ? routine.dueDate.split('T')[0] : ''); }}>
          <IoCreate size={16} />
        </button>
        <button className="btn-outline" style={{ width: 'auto', padding: '12px 14px' }}
          onClick={() => onClone(routine)}>
          <IoCopy size={16} />
        </button>
        <button className="btn-danger" style={{ width: 'auto', padding: '12px 14px' }}
          onClick={() => setConfirmDelete(true)}>
          <IoTrash size={16} />
        </button>
      </div>

      {/* Edit section */}
      {editing && (
        <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit}>Save</button>
            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : entries.length === 0 ? (
        <EmptyState title="No entries yet" subtitle="Log your first entry" />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {entries.map((entry) => (
            <div key={entry._id} style={{
              padding: '10px 0', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {entry.status === 'complete'
                    ? <IoCheckmarkCircle size={16} color="var(--success)" />
                    : <IoCloseCircle size={16} color="var(--danger)" />}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.status}</span>
                  {entry.manualDate && <span className="badge badge-warning">Manual</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(entry.date)}</div>
                {entry.fieldValues?.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {entry.fieldValues.map((fv, i) => (
                      <div key={i}>{fv.label}: <strong>{
                        Array.isArray(fv.value) ? fv.value.join(', ')
                        : typeof fv.value === 'number' && fv.value >= 1 && fv.value <= 5
                          ? '★'.repeat(fv.value) + '☆'.repeat(5 - fv.value)
                          : String(fv.value)
                      }</strong></div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn-ghost" style={{ color: 'var(--danger)', padding: 4 }}
                onClick={() => setConfirmDeleteEntry(entry)}>
                <IoTrash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {logModal && (
        <LogEntryModal open={logModal} routine={routine}
          onClose={() => setLogModal(false)} onDone={() => { fetchEntries(); onDone(); }} />
      )}

      <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete routine?"
        message={`Delete "${routine?.name}" and all its ${entries.length} entries? This cannot be undone.`} />

      <ConfirmModal open={!!confirmDeleteEntry} onClose={() => setConfirmDeleteEntry(null)}
        onConfirm={handleDeleteEntry}
        title="Delete entry?"
        message="Are you sure you want to delete this entry?" />
    </Modal>
  );
}

function LogEntryModal({ open, routine, onClose, onDone }) {
  const [status, setStatus] = useState('complete');
  const [manualDate, setManualDate] = useState(false);
  const [date, setDate] = useState('');
  const [fieldValues, setFieldValues] = useState({});
  const [loading, setLoading] = useState(false);

  const handleFieldChange = (fieldId, label, value) => {
    setFieldValues({ ...fieldValues, [fieldId]: { fieldId, label, value } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await logRoutineEntry(routine._id, {
        status,
        manualDate,
        date: manualDate ? date : undefined,
        fieldValues: Object.values(fieldValues),
      });
      toast.success('Entry logged');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Entry">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={manualDate} onChange={(e) => setManualDate(e.target.checked)}
            style={{ width: 'auto' }} />
          <label style={{ margin: 0 }}>Set date manually</label>
        </div>

        {manualDate && (
          <div className="form-group">
            <label>Date</label>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        )}

        {routine?.fields?.map((field) => (
          <div key={field._id} className="form-group">
            <label>{field.label}</label>
            {field.type === 'text' ? (
              <input type="text" placeholder={field.label}
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'textarea' ? (
              <textarea placeholder={field.label} rows={3}
                style={{ resize: 'vertical' }}
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'number' ? (
              <input type="number" placeholder={field.label}
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'date' ? (
              <input type="date"
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'time' ? (
              <input type="time"
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'rating' ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button"
                    onClick={() => handleFieldChange(field._id, field.label, star)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, padding: 2,
                      color: (fieldValues[field._id]?.value || 0) >= star ? '#FFD93D' : 'var(--text-muted)',
                    }}>
                    ★
                  </button>
                ))}
              </div>
            ) : field.type === 'radio' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {field.options.map((opt) => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name={field._id} value={opt}
                      onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)}
                      style={{ width: 'auto' }} />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {field.options.map((opt) => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" value={opt}
                      onChange={(e) => {
                        const current = fieldValues[field._id]?.value || [];
                        const newVal = e.target.checked
                          ? [...current, opt]
                          : current.filter((v) => v !== opt);
                        handleFieldChange(field._id, field.label, newVal);
                      }}
                      style={{ width: 'auto' }} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logging...' : 'Log Entry'}
        </button>
      </form>
    </Modal>
  );
}
