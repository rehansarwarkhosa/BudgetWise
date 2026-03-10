import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  IoAdd, IoTrash, IoCopy, IoSearch, IoClose, IoChevronForward, IoChevronBack,
  IoWallet, IoFlag, IoAlarm, IoCreate, IoSave, IoFilter, IoCalendar,
} from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { formatDateTime, formatDate, formatPKR } from '../utils/format';
import { useSettings } from '../context/SettingsContext';
import useSwipeTabs from '../hooks/useSwipeTabs';
import api from '../api/axios.js';
import {
  getWorkOrders, createWorkOrder, updateWorkOrder, moveWorkOrder, deleteWorkOrder,
  getWorkOrderNotes, addWorkOrderNote, updateWorkOrderNote, deleteWorkOrderNote,
  logWorkOrderExpense, getBudgets,
} from '../api';

const PRIORITY_COLORS = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' };
const STATUS_LABELS = { todo: 'Todo', doing: 'Doing', done: 'Done' };
const COLUMNS = ['todo', 'doing', 'done'];
const COLUMN_COLORS = { todo: '#6C63FF', doing: '#F59E0B', done: '#22C55E' };

const RICH_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', '#1A1A2E', '#F1F1F6'];

function getDueDateColor(dueDate, colorSettings) {
  if (!dueDate) return null;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  now.setHours(0, 0, 0, 0);
  const due = new Date(new Date(dueDate).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  due.setHours(0, 0, 0, 0);
  const diffMs = due - now;
  const daysRemaining = Math.ceil(diffMs / 86400000);

  const warn = colorSettings?.warningDays ?? 3;
  const danger = colorSettings?.dangerDays ?? 1;
  const warnColor = colorSettings?.warningColor || '#f59e0b';
  const dangerColor = colorSettings?.dangerColor || '#ef4444';
  const overdueColor = colorSettings?.overdueColor || '#dc2626';

  if (daysRemaining < 0) return overdueColor;
  if (daysRemaining <= danger) return dangerColor;
  if (daysRemaining <= warn) return warnColor;
  return null;
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

export default function KanbanBoard() {
  const { settings } = useSettings();
  const dueDateColors = settings?.kanbanDueDateColors;
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterBudgetType, setFilterBudgetType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  const fetchWorkOrders = useCallback(async (search, priority, budgetType) => {
    try {
      const params = {};
      if (search) params.search = search;
      if (priority) params.priority = priority;
      if (budgetType) params.budgetType = budgetType;
      const res = await getWorkOrders(params);
      setWorkOrders(res.data);
    } catch (err) { toast.error(err.message); }
  }, []);

  useEffect(() => {
    fetchWorkOrders('', '', '').finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchWorkOrders(searchQuery, filterPriority, filterBudgetType);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, filterPriority, filterBudgetType]);

  const refresh = () => fetchWorkOrders(searchQuery, filterPriority, filterBudgetType);

  const handleMove = async (id, newStatus) => {
    try {
      const res = await moveWorkOrder(id, newStatus);
      setWorkOrders(prev => prev.map(w => w._id === id ? res.data : w));
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteWorkOrder(confirmDelete._id);
      setWorkOrders(prev => prev.filter(w => w._id !== confirmDelete._id));
      toast.success('Deleted');
    } catch (err) { toast.error(err.message); }
  };

  const handleCopy = async (wo) => {
    try {
      const notesRes = await getWorkOrderNotes(wo._id);
      const notes = notesRes.data || [];
      let text = `📋 Work Order: ${wo.title}\n`;
      text += `Priority: ${wo.priority.charAt(0).toUpperCase() + wo.priority.slice(1)}\n`;
      text += `Status: ${STATUS_LABELS[wo.status]}\n`;
      if (wo.budgetId) {
        text += `Budget: ${wo.budgetId?.name || 'Linked'} — ${formatPKR(wo.budgetAmount)}\n`;
        text += `Expense Status: ${wo.budgetExpenseStatus}\n`;
      }
      if (wo.dueDate) text += `Due: ${formatDate(wo.dueDate)}\n`;
      text += `Created: ${formatDateTime(wo.createdAt)}\n`;
      if (notes.length > 0) {
        text += `\n--- Notes ---\n`;
        notes.forEach((n, i) => {
          text += `\n[${i + 1}] ${stripHtml(n.content)}\n`;
          text += `    Added: ${formatDateTime(n.createdAt)}`;
          if (n.updatedAt !== n.createdAt) text += ` | Updated: ${formatDateTime(n.updatedAt)}`;
          text += '\n';
        });
      }
      navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch (err) { toast.error('Copy failed'); }
  };

  // Drag and drop handlers
  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e, col) => { e.preventDefault(); setDragOverCol(col); };
  const onDragLeave = () => setDragOverCol(null);
  const onDrop = (e, col) => {
    e.preventDefault();
    setDragOverCol(null);
    if (dragId) {
      const wo = workOrders.find(w => w._id === dragId);
      if (wo && wo.status !== col) handleMove(dragId, col);
    }
    setDragId(null);
  };

  const getColumnOrders = (status) => workOrders.filter(w => w.status === status);

  if (loading) return <Spinner />;

  return (
    <div>
      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        {searchMode ? (
          <input ref={searchRef} type="text" placeholder="Search work orders..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, fontSize: 13 }} autoFocus />
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <button className="btn-ghost" onClick={() => {
          if (searchMode) { setSearchMode(false); setSearchQuery(''); }
          else { setSearchMode(true); setTimeout(() => searchRef.current?.focus(), 50); }
        }} style={{ padding: 6, borderRadius: 8, background: searchMode ? 'var(--bg-input)' : 'transparent' }}>
          {searchMode ? <IoClose size={18} /> : <IoSearch size={18} />}
        </button>
        <button className="btn-ghost" onClick={() => setShowFilters(!showFilters)}
          style={{ padding: 6, borderRadius: 8, background: (filterPriority || filterBudgetType) ? 'var(--primary)' + '30' : showFilters ? 'var(--bg-input)' : 'transparent' }}>
          <IoFilter size={18} />
        </button>
        <button className="btn-primary" onClick={() => setShowCreate(true)}
          style={{ padding: '6px 12px', fontSize: 13, width: 'auto' }}>
          <IoAdd size={16} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card" style={{ padding: 10, marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            style={{ flex: 1, fontSize: 12, minWidth: 100 }}>
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select value={filterBudgetType} onChange={e => setFilterBudgetType(e.target.value)}
            style={{ flex: 1, fontSize: 12, minWidth: 100 }}>
            <option value="">All Types</option>
            <option value="budget">Budget Linked</option>
            <option value="simple">Simple</option>
          </select>
          {(filterPriority || filterBudgetType) && (
            <button className="btn-ghost" onClick={() => { setFilterPriority(''); setFilterBudgetType(''); }}
              style={{ fontSize: 11, padding: '4px 8px' }}>Clear</button>
          )}
        </div>
      )}

      {/* Kanban Board */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
        minHeight: 300, WebkitOverflowScrolling: 'touch',
      }}>
        {COLUMNS.map(col => (
          <div key={col}
            onDragOver={e => onDragOver(e, col)}
            onDragLeave={onDragLeave}
            onDrop={e => onDrop(e, col)}
            style={{
              flex: '1 0 140px', minWidth: 140,
              background: dragOverCol === col ? COLUMN_COLORS[col] + '15' : 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)', padding: 8,
              border: `1px solid ${dragOverCol === col ? COLUMN_COLORS[col] : 'var(--border)'}`,
              transition: 'border-color 0.2s, background 0.2s',
              display: 'flex', flexDirection: 'column',
            }}>
            {/* Column Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8, paddingBottom: 6,
              borderBottom: `2px solid ${COLUMN_COLORS[col]}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLUMN_COLORS[col], textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {STATUS_LABELS[col]}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, background: COLUMN_COLORS[col] + '25',
                color: COLUMN_COLORS[col], padding: '2px 6px', borderRadius: 10,
              }}>
                {getColumnOrders(col).length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 60 }}>
              {getColumnOrders(col).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 4px', color: 'var(--text-muted)', fontSize: 11 }}>
                  No items
                </div>
              ) : getColumnOrders(col).map(wo => {
                const cardDueColor = wo.status !== 'done' ? getDueDateColor(wo.dueDate, dueDateColors) : null;
                return (
                <div key={wo._id} draggable
                  onDragStart={e => onDragStart(e, wo._id)}
                  onClick={() => setDetailId(wo._id)}
                  style={{
                    background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                    padding: 8, cursor: 'pointer',
                    border: cardDueColor ? `1.5px solid ${cardDueColor}` : '1px solid var(--border)',
                    borderLeft: cardDueColor ? `3px solid ${cardDueColor}` : undefined,
                    opacity: dragId === wo._id ? 0.5 : 1,
                    transition: 'opacity 0.2s, transform 0.1s',
                  }}>
                  {/* Title */}
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {wo.title}
                  </p>

                  {/* Priority + Budget indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      background: PRIORITY_COLORS[wo.priority] + '25',
                      color: PRIORITY_COLORS[wo.priority],
                      padding: '1px 5px', borderRadius: 4,
                    }}>
                      {wo.priority}
                    </span>
                    {wo.budgetId && (
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        background: '#6C63FF25', color: '#6C63FF',
                        padding: '1px 5px', borderRadius: 4,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <IoWallet size={8} /> {formatPKR(wo.budgetAmount)}
                      </span>
                    )}
                    {wo.budgetId && wo.budgetExpenseStatus !== 'none' && wo.budgetExpenseStatus !== 'completed' && (
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        background: wo.budgetExpenseStatus === 'failed' ? '#EF444425' : '#F59E0B25',
                        color: wo.budgetExpenseStatus === 'failed' ? '#EF4444' : '#F59E0B',
                        padding: '1px 5px', borderRadius: 4,
                      }}>
                        {wo.budgetExpenseStatus === 'pending' ? 'Expense Pending' : 'Expense Failed'}
                      </span>
                    )}
                    {wo.budgetId && wo.budgetExpenseStatus === 'completed' && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, background: '#22C55E25', color: '#22C55E',
                        padding: '1px 5px', borderRadius: 4,
                      }}>
                        Expense Logged
                      </span>
                    )}
                    {wo.dueDate && (
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        background: (cardDueColor || 'var(--text-muted)') + '20',
                        color: cardDueColor || 'var(--text-muted)',
                        padding: '1px 5px', borderRadius: 4,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <IoCalendar size={8} /> {formatDate(wo.dueDate)}
                      </span>
                    )}
                  </div>

                  {/* Date + Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      {formatDateTime(wo.createdAt)}
                    </span>
                    <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                      {col !== 'todo' && (
                        <button className="btn-ghost" style={{ padding: 2 }}
                          onClick={() => handleMove(wo._id, COLUMNS[COLUMNS.indexOf(col) - 1])}>
                          <IoChevronBack size={12} color="var(--text-muted)" />
                        </button>
                      )}
                      {col !== 'done' && (
                        <button className="btn-ghost" style={{ padding: 2 }}
                          onClick={() => handleMove(wo._id, COLUMNS[COLUMNS.indexOf(col) + 1])}>
                          <IoChevronForward size={12} color="var(--text-muted)" />
                        </button>
                      )}
                      <button className="btn-ghost" style={{ padding: 2 }} onClick={() => handleCopy(wo)}>
                        <IoCopy size={11} color="var(--text-muted)" />
                      </button>
                      <button className="btn-ghost" style={{ padding: 2 }} onClick={() => setConfirmDelete(wo)}>
                        <IoTrash size={11} color="var(--danger)" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateWorkOrderModal
          onClose={() => setShowCreate(false)}
          onCreated={(wo) => { setWorkOrders(prev => [wo, ...prev]); setShowCreate(false); }}
        />
      )}

      {/* Detail Modal */}
      {detailId && (
        <WorkOrderDetailModal
          workOrderId={detailId}
          onClose={() => { setDetailId(null); refresh(); }}
          onDeleted={(id) => { setWorkOrders(prev => prev.filter(w => w._id !== id)); setDetailId(null); }}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete work order?"
        message={`Delete "${confirmDelete?.title?.slice(0, 50)}${confirmDelete?.title?.length > 50 ? '...' : ''}"?`} />
    </div>
  );
}

// ──────────────────────── Create Modal ────────────────────────

function CreateWorkOrderModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [isBudget, setIsBudget] = useState(false);
  const [budgetId, setBudgetId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBudgets().then(res => setBudgets(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const data = { title: title.trim(), priority };
      if (dueDate) data.dueDate = dueDate;
      if (isBudget && budgetId) {
        data.budgetId = budgetId;
        data.budgetAmount = parseFloat(budgetAmount) || 0;
      }
      const res = await createWorkOrder(data);
      onCreated(res.data);
      toast.success('Work order created');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalContent} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>New Work Order</h3>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><IoClose size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Work order title" autoFocus />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['low', 'medium', 'high'].map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                    border: `2px solid ${priority === p ? PRIORITY_COLORS[p] : 'var(--border)'}`,
                    background: priority === p ? PRIORITY_COLORS[p] + '20' : 'transparent',
                    color: priority === p ? PRIORITY_COLORS[p] : 'var(--text-secondary)',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Due Date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={isBudget} onChange={e => setIsBudget(e.target.checked)}
                style={{ width: 16, height: 16 }} />
              <span>Link to Budget</span>
            </label>
          </div>

          {isBudget && (
            <>
              <div className="form-group">
                <label>Budget</label>
                <select value={budgetId} onChange={e => setBudgetId(e.target.value)}>
                  <option value="">Select budget...</option>
                  {budgets.map(b => (
                    <option key={b._id} value={b._id}>{b.name} (Remaining: {formatPKR(b.remainingAmount)})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (PKR)</label>
                <input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary" disabled={saving || !title.trim()}
            style={{ width: '100%', marginTop: 8 }}>
            {saving ? 'Creating...' : 'Create Work Order'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────── Detail Modal ────────────────────────

function WorkOrderDetailModal({ workOrderId, onClose, onDeleted }) {
  const [wo, setWo] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editBudgetId, setEditBudgetId] = useState('');
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Notes state
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const noteEditorRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#6C63FF');

  // Reminders state
  const [reminders, setReminders] = useState([]);
  const [remindersDirty, setRemindersDirty] = useState(false);

  useEffect(() => {
    loadDetail();
    getBudgets().then(res => setBudgets(res.data)).catch(() => {});
  }, [workOrderId]);

  const loadDetail = async () => {
    try {
      const woResp = await api.get(`/workorders/${workOrderId}`);
      const data = woResp.data.data || woResp.data;
      setWo(data);
      setNotes(data.notes || []);
      setEditTitle(data.title);
      setEditPriority(data.priority);
      setEditStatus(data.status);
      setEditBudgetId(data.budgetId?._id || data.budgetId || '');
      setEditBudgetAmount(data.budgetAmount || 0);
      setEditDueDate(data.dueDate ? new Date(data.dueDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) : '');
      setReminders(data.reminders || []);
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const data = {
        title: editTitle, priority: editPriority, status: editStatus,
        budgetId: editBudgetId || null,
        budgetAmount: editBudgetId ? parseFloat(editBudgetAmount) || 0 : 0,
        dueDate: editDueDate || null,
      };
      if (remindersDirty) data.reminders = reminders;
      const res = await updateWorkOrder(workOrderId, data);
      setWo(res.data);
      setEditing(false);
      setRemindersDirty(false);
      toast.success('Saved');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleLogExpense = async () => {
    try {
      const res = await logWorkOrderExpense(workOrderId);
      setWo(res.data.workOrder);
      toast.success('Expense logged to budget!');
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  };

  const handleDelete = async () => {
    try {
      await deleteWorkOrder(workOrderId);
      toast.success('Deleted');
      onDeleted(workOrderId);
    } catch (err) { toast.error(err.message); }
  };

  // Notes handlers
  const handleAddNote = async () => {
    const content = noteEditorRef.current?.innerHTML;
    if (!content?.trim() || !stripHtml(content).trim()) return;
    try {
      if (editingNoteId) {
        await updateWorkOrderNote(editingNoteId, { content });
        setEditingNoteId(null);
        toast.success('Note updated');
      } else {
        await addWorkOrderNote(workOrderId, { content });
        toast.success('Note added');
      }
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = '';
      // Reload notes
      const notesRes = await getWorkOrderNotes(workOrderId);
      setNotes(notesRes.data);
    } catch (err) { toast.error(err.message); }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    if (noteEditorRef.current) noteEditorRef.current.innerHTML = note.content;
    setTab('notes');
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteWorkOrderNote(noteId);
      setNotes(prev => prev.filter(n => n._id !== noteId));
      toast.success('Note deleted');
    } catch (err) { toast.error(err.message); }
  };

  // Reminder handlers
  const addReminder = () => {
    setReminders(prev => [...prev, {
      type: 'daily', time: '09:00', days: [], dates: [], enabled: true,
    }]);
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

  const execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val);
    noteEditorRef.current?.focus();
  };

  if (loading) return (
    <div style={modalBackdrop}><div style={modalContent}><Spinner /></div></div>
  );

  const detailSwipe = useSwipeTabs(['info', 'notes', 'reminders'], tab, setTab);

  if (!wo) return null;

  const hasBudget = !!(wo.budgetId);
  const isDone = wo.status === 'done';
  const showExpenseBtn = hasBudget && isDone && wo.budgetExpenseStatus !== 'completed';

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={{ ...modalContent, maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}
        onTouchStart={detailSwipe.onTouchStart} onTouchEnd={detailSwipe.onTouchEnd}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{wo.title}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                background: PRIORITY_COLORS[wo.priority] + '25', color: PRIORITY_COLORS[wo.priority],
                padding: '2px 6px', borderRadius: 4,
              }}>{wo.priority}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                background: COLUMN_COLORS[wo.status] + '25', color: COLUMN_COLORS[wo.status],
                padding: '2px 6px', borderRadius: 4,
              }}>{STATUS_LABELS[wo.status]}</span>
              {hasBudget && (
                <span style={{ fontSize: 10, fontWeight: 600, background: '#6C63FF25', color: '#6C63FF', padding: '2px 6px', borderRadius: 4 }}>
                  <IoWallet size={9} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                  {wo.budgetId?.name || 'Budget'} — {formatPKR(wo.budgetAmount)}
                </span>
              )}
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><IoClose size={20} /></button>
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: wo.dueDate ? 4 : 12 }}>
          Created: {formatDateTime(wo.createdAt)}
        </span>
        {wo.dueDate && (
          <span style={{ fontSize: 11, color: getDueDateColor(wo.dueDate, settings?.kanbanDueDateColors) || 'var(--text-muted)', display: 'block', marginBottom: 12 }}>
            <IoCalendar size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
            Due: {formatDate(wo.dueDate)}
          </span>
        )}

        {/* Expense Button */}
        {showExpenseBtn && (
          <button className="btn-primary" onClick={handleLogExpense}
            style={{ width: '100%', marginBottom: 10, fontSize: 13, background: wo.budgetExpenseStatus === 'failed' ? 'var(--danger)' : undefined }}>
            <IoWallet size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {wo.budgetExpenseStatus === 'failed' ? 'Retry: Add Expense to Budget' : 'Add Expense to Budget'}
          </button>
        )}

        {hasBudget && wo.budgetExpenseStatus === 'completed' && (
          <div style={{ background: '#22C55E15', border: '1px solid #22C55E40', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 10, fontSize: 12, color: '#22C55E' }}>
            Expense logged to {wo.budgetId?.name || 'budget'}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          {['info', 'notes', 'reminders'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                textTransform: 'capitalize',
              }}>
              {t === 'info' ? 'Details' : t === 'notes' ? `Notes (${notes.length})` : `Reminders (${reminders.length})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'info' && (
          <div>
            {!editing ? (
              <div>
                <button className="btn-outline" onClick={() => setEditing(true)}
                  style={{ width: '100%', marginBottom: 10, fontSize: 12 }}>
                  <IoCreate size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Edit Details
                </button>
                <div style={{ display: 'grid', gap: 8 }}>
                  <InfoRow label="Title" value={wo.title} />
                  <InfoRow label="Priority" value={wo.priority} color={PRIORITY_COLORS[wo.priority]} />
                  <InfoRow label="Status" value={STATUS_LABELS[wo.status]} color={COLUMN_COLORS[wo.status]} />
                  {wo.dueDate && <InfoRow label="Due Date" value={formatDate(wo.dueDate)} color={getDueDateColor(wo.dueDate, settings?.kanbanDueDateColors)} />}
                  {hasBudget && <InfoRow label="Budget" value={`${wo.budgetId?.name || ''} — ${formatPKR(wo.budgetAmount)}`} />}
                  {hasBudget && <InfoRow label="Expense Status" value={wo.budgetExpenseStatus} />}
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['low', 'medium', 'high'].map(p => (
                      <button key={p} type="button" onClick={() => setEditPriority(p)}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                          border: `2px solid ${editPriority === p ? PRIORITY_COLORS[p] : 'var(--border)'}`,
                          background: editPriority === p ? PRIORITY_COLORS[p] + '20' : 'transparent',
                          color: editPriority === p ? PRIORITY_COLORS[p] : 'var(--text-secondary)',
                          cursor: 'pointer', textTransform: 'capitalize',
                        }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    {COLUMNS.map(c => <option key={c} value={c}>{STATUS_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date (optional)</label>
                  <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={!!editBudgetId}
                      onChange={e => { if (!e.target.checked) setEditBudgetId(''); else setEditBudgetId(budgets[0]?._id || ''); }}
                      style={{ width: 16, height: 16 }} />
                    <span>Link to Budget</span>
                  </label>
                </div>
                {editBudgetId && (
                  <>
                    <div className="form-group">
                      <label>Budget</label>
                      <select value={editBudgetId} onChange={e => setEditBudgetId(e.target.value)}>
                        <option value="">Select budget...</option>
                        {budgets.map(b => (
                          <option key={b._id} value={b._id}>{b.name} ({formatPKR(b.remainingAmount)})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Amount (PKR)</label>
                      <input type="number" value={editBudgetAmount} onChange={e => setEditBudgetAmount(e.target.value)}
                        min="0" step="0.01" />
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn-ghost" onClick={() => setEditing(false)} style={{ flex: 1, fontSize: 12 }}>Cancel</button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1, fontSize: 12 }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Copy & Delete */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button className="btn-outline" onClick={() => {
                const wo2 = wo;
                // Reuse parent's copy logic
                (async () => {
                  let text = `📋 Work Order: ${wo2.title}\n`;
                  text += `Priority: ${wo2.priority.charAt(0).toUpperCase() + wo2.priority.slice(1)}\n`;
                  text += `Status: ${STATUS_LABELS[wo2.status]}\n`;
                  if (wo2.budgetId) {
                    text += `Budget: ${wo2.budgetId?.name || 'Linked'} — ${formatPKR(wo2.budgetAmount)}\n`;
                    text += `Expense Status: ${wo2.budgetExpenseStatus}\n`;
                  }
                  if (wo2.dueDate) text += `Due: ${formatDate(wo2.dueDate)}\n`;
                  text += `Created: ${formatDateTime(wo2.createdAt)}\n`;
                  if (notes.length > 0) {
                    text += `\n--- Notes ---\n`;
                    notes.forEach((n, i) => {
                      text += `\n[${i + 1}] ${stripHtml(n.content)}\n`;
                      text += `    Added: ${formatDateTime(n.createdAt)}`;
                      if (n.updatedAt !== n.createdAt) text += ` | Updated: ${formatDateTime(n.updatedAt)}`;
                      text += '\n';
                    });
                  }
                  navigator.clipboard.writeText(text);
                  toast.success('Copied');
                })();
              }} style={{ flex: 1, fontSize: 12 }}>
                <IoCopy size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Copy
              </button>
              <button className="btn-danger" onClick={() => setConfirmDelete(true)} style={{ flex: 1, fontSize: 12 }}>
                <IoTrash size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Delete
              </button>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div>
            {/* Rich Text Toolbar */}
            <div style={{
              display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6,
              padding: '4px 0', borderBottom: '1px solid var(--border)',
            }}>
              <button type="button" className="btn-ghost" onClick={() => execCmd('bold')}
                style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>B</button>
              <button type="button" className="btn-ghost" onClick={() => execCmd('italic')}
                style={{ padding: '4px 8px', fontSize: 12, fontStyle: 'italic' }}>I</button>
              <button type="button" className="btn-ghost" onClick={() => execCmd('underline')}
                style={{ padding: '4px 8px', fontSize: 12, textDecoration: 'underline' }}>U</button>
              <div style={{ position: 'relative' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowColorPicker(!showColorPicker)}
                  style={{ padding: '4px 8px', fontSize: 12 }}>
                  A<span style={{ display: 'inline-block', width: 10, height: 3, background: customColor, marginLeft: 2, verticalAlign: 'bottom' }} />
                </button>
                {showColorPicker && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 20,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: 8,
                    display: 'flex', gap: 4, flexWrap: 'wrap', width: 160,
                  }}>
                    {RICH_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => { execCmd('foreColor', c); setCustomColor(c); setShowColorPicker(false); }}
                        style={{ width: 24, height: 24, borderRadius: 4, background: c, border: '2px solid var(--border)', cursor: 'pointer' }} />
                    ))}
                    <input type="color" value={customColor}
                      onChange={e => { execCmd('foreColor', e.target.value); setCustomColor(e.target.value); setShowColorPicker(false); }}
                      style={{ width: 24, height: 24, padding: 0, border: 'none', cursor: 'pointer' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Editor */}
            <div ref={noteEditorRef} contentEditable suppressContentEditableWarning
              style={{
                minHeight: 80, padding: 10, background: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                fontSize: 13, lineHeight: 1.5, marginBottom: 8, color: 'var(--text)',
                outline: 'none',
              }}
              data-placeholder="Add a note..."
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {editingNoteId && (
                <button className="btn-ghost" onClick={() => { setEditingNoteId(null); if (noteEditorRef.current) noteEditorRef.current.innerHTML = ''; }}
                  style={{ flex: 1, fontSize: 12 }}>Cancel</button>
              )}
              <button className="btn-primary" onClick={handleAddNote}
                style={{ flex: 1, fontSize: 12, width: 'auto' }}>
                <IoSave size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {editingNoteId ? 'Update Note' : 'Add Note'}
              </button>
            </div>

            {/* Notes List */}
            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No notes yet</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {notes.map(note => (
                  <div key={note._id} className="card" style={{ padding: 10 }}>
                    <div dangerouslySetInnerHTML={{ __html: note.content }}
                      style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, wordBreak: 'break-word' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {formatDateTime(note.createdAt)}
                        {note.updatedAt !== note.createdAt && (
                          <span> · edited {formatDateTime(note.updatedAt)}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-ghost" style={{ padding: 3 }} onClick={() => handleEditNote(note)}>
                          <IoCreate size={13} color="var(--text-muted)" />
                        </button>
                        <button className="btn-ghost" style={{ padding: 3 }} onClick={() => handleDeleteNote(note._id)}>
                          <IoTrash size={13} color="var(--danger)" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reminders' && (
          <div>
            <button className="btn-outline" onClick={addReminder}
              style={{ width: '100%', marginBottom: 12, fontSize: 12 }}>
              <IoAlarm size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Add Reminder
            </button>

            {reminders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No reminders</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {reminders.map((rem, idx) => (
                  <div key={idx} className="card" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                      <select value={rem.type} onChange={e => updateReminder(idx, 'type', e.target.value)}
                        style={{ flex: 1, fontSize: 12 }}>
                        <option value="daily">Daily</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="custom_days">Custom Days</option>
                        <option value="custom_dates">Custom Dates</option>
                      </select>
                      <input type="time" value={rem.time} onChange={e => updateReminder(idx, 'time', e.target.value)}
                        style={{ width: 100, fontSize: 12 }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <input type="checkbox" checked={rem.enabled}
                          onChange={e => updateReminder(idx, 'enabled', e.target.checked)}
                          style={{ width: 14, height: 14 }} />
                        On
                      </label>
                      <button className="btn-ghost" style={{ padding: 3 }} onClick={() => removeReminder(idx)}>
                        <IoTrash size={14} color="var(--danger)" />
                      </button>
                    </div>

                    {rem.type === 'custom_days' && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                          <button key={i} type="button"
                            onClick={() => {
                              const days = rem.days || [];
                              updateReminder(idx, 'days', days.includes(i) ? days.filter(x => x !== i) : [...days, i]);
                            }}
                            style={{
                              padding: '3px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                              border: '1px solid var(--border)',
                              background: (rem.days || []).includes(i) ? 'var(--primary)' : 'transparent',
                              color: (rem.days || []).includes(i) ? '#fff' : 'var(--text-secondary)',
                            }}>
                            {d}
                          </button>
                        ))}
                      </div>
                    )}

                    {rem.type === 'custom_dates' && (
                      <div>
                        <input type="date"
                          onChange={e => {
                            if (e.target.value) {
                              const dates = rem.dates || [];
                              updateReminder(idx, 'dates', [...dates, e.target.value]);
                              e.target.value = '';
                            }
                          }}
                          style={{ fontSize: 12, marginBottom: 4 }} />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(rem.dates || []).map((d, di) => (
                            <span key={di} style={{
                              fontSize: 10, background: 'var(--bg-input)', padding: '2px 6px',
                              borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              {formatDate(d)}
                              <IoClose size={10} style={{ cursor: 'pointer' }}
                                onClick={() => updateReminder(idx, 'dates', (rem.dates || []).filter((_, j) => j !== di))} />
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {remindersDirty && (
              <button className="btn-primary" onClick={handleSave} disabled={saving}
                style={{ width: '100%', marginTop: 12, fontSize: 12 }}>
                {saving ? 'Saving...' : 'Save Reminders'}
              </button>
            )}
          </div>
        )}

        <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Delete work order?"
          message={`Delete "${wo.title}"? This cannot be undone.`} />
      </div>
    </div>
  );
}

// ──────────────────────── Helpers ────────────────────────

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, ...(color ? { color } : {}), textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}

const modalBackdrop = {
  position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};

const modalContent = {
  background: 'var(--bg-card)', borderRadius: 'var(--radius)',
  padding: 20, width: '100%', maxWidth: 420,
  border: '1px solid var(--border)',
};
