import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  IoAdd, IoTrash, IoCopy, IoSearch, IoClose, IoChevronForward, IoChevronBack,
  IoWallet, IoFlag, IoAlarm, IoCreate, IoFilter, IoCalendar,
  IoArchive, IoArrowUndo, IoChevronDown, IoChevronUp, IoList, IoGrid,
  IoLockClosed, IoLockOpen,
} from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import RichTextEditor from '../components/RichTextEditor';
import { formatDateTime, formatDate, formatPKR } from '../utils/format';
import { useSettings } from '../context/SettingsContext';
import useSwipeTabs from '../hooks/useSwipeTabs';
import api from '../api/axios.js';
import {
  getWorkOrders, createWorkOrder, updateWorkOrder, moveWorkOrder, deleteWorkOrder,
  getWorkOrderNotes, addWorkOrderNote, updateWorkOrderNote, deleteWorkOrderNote,
  logWorkOrderExpense, getBudgets, bulkArchiveWorkOrders, getArchivedWorkOrders,
  getPriceItems, duplicateWorkOrder, bulkMoveWorkOrders,
} from '../api';

const PRIORITY_COLORS = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' };
const STATUS_LABELS = { backlog: 'Backlog', todo: 'Todo', doing: 'Doing', done: 'Done', archived: 'Archived' };
const COLUMNS = ['todo', 'doing', 'done'];
const COLUMN_COLORS = { backlog: '#6B7280', todo: '#3AAFB9', doing: '#F59E0B', done: '#22C55E', archived: '#6B7280' };


function getDueDateColor(dueDate, colorSettings) {
  if (!dueDate) return null;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  now.setHours(0, 0, 0, 0);
  const due = new Date(new Date(dueDate).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  due.setHours(0, 0, 0, 0);
  const diffMs = due - now;
  const daysRemaining = Math.ceil(diffMs / 86400000);

  const overdueColor = colorSettings?.overdueColor || '#dc2626';
  if (daysRemaining < 0) return overdueColor;

  const rules = colorSettings?.rules || [
    { days: 1, color: '#ef4444' },
    { days: 3, color: '#f59e0b' },
  ];
  const sorted = [...rules].sort((a, b) => a.days - b.days);
  for (const rule of sorted) {
    if (daysRemaining <= rule.days) return rule.color;
  }
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
  const [archivedOrders, setArchivedOrders] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [backlogOrders, setBacklogOrders] = useState([]);
  const [showBacklog, setShowBacklog] = useState(false);
  const [backlogSelected, setBacklogSelected] = useState([]);
  const [showBacklogCreate, setShowBacklogCreate] = useState(false);
  const [duplicateWo, setDuplicateWo] = useState(null);
  const [duplicateCount, setDuplicateCount] = useState(1);
  const [activeTab, setActiveTab] = useState('doing');
  const [viewMode, setViewMode] = useState('tabs');
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  // Swipe-to-move state
  const [swipingId, setSwipingId] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef({ x: 0, y: 0 });
  const touchLocked = useRef(false);

  // Swipe confirm state
  const [swipeConfirm, setSwipeConfirm] = useState(null); // { id, newStatus }

  // Quick status popup
  const [quickStatusId, setQuickStatusId] = useState(null);
  const [quickStatusPos, setQuickStatusPos] = useState(null);

  // Quick budget edit
  const [quickBudgetWo, setQuickBudgetWo] = useState(null);
  const [quickBudgetId, setQuickBudgetId] = useState('');
  const [quickBudgetAmount, setQuickBudgetAmount] = useState('');
  const [quickBudgetBudgets, setQuickBudgetBudgets] = useState([]);
  const [quickBudgetSaving, setQuickBudgetSaving] = useState(false);

  const fetchArchived = useCallback(async () => {
    try {
      const res = await getArchivedWorkOrders();
      setArchivedOrders(res.data);
    } catch (err) { /* silent */ }
  }, []);

  const fetchBacklog = useCallback(async () => {
    try {
      const res = await getWorkOrders({ status: 'backlog' });
      setBacklogOrders(res.data);
    } catch (err) { /* silent */ }
  }, []);

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
    Promise.all([fetchWorkOrders('', '', ''), fetchArchived(), fetchBacklog()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchWorkOrders(searchQuery, filterPriority, filterBudgetType);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, filterPriority, filterBudgetType]);

  const refresh = () => { fetchWorkOrders(searchQuery, filterPriority, filterBudgetType); fetchArchived(); fetchBacklog(); };

  const handleArchive = async (id) => {
    try {
      const res = await moveWorkOrder(id, 'archived');
      setWorkOrders(prev => prev.filter(w => w._id !== id));
      setArchivedOrders(prev => [res.data, ...prev]);
      toast.success('Archived');
    } catch (err) { toast.error(err.message); }
  };

  const handleUnarchive = async (id) => {
    try {
      const res = await moveWorkOrder(id, 'done');
      setArchivedOrders(prev => prev.filter(w => w._id !== id));
      setWorkOrders(prev => [res.data, ...prev]);
      toast.success('Moved to Done');
    } catch (err) { toast.error(err.message); }
  };

  const handleBulkArchive = async () => {
    const doneCount = workOrders.filter(w => w.status === 'done').length;
    if (doneCount === 0) return;
    try {
      await bulkArchiveWorkOrders();
      toast.success(`Archived ${doneCount} item${doneCount > 1 ? 's' : ''}`);
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const handleMove = async (id, newStatus) => {
    const wo = [...workOrders, ...backlogOrders, ...archivedOrders].find(w => w._id === id);
    if (wo?.locked) return toast.error('This work order is locked');
    try {
      const res = await moveWorkOrder(id, newStatus);
      if (newStatus === 'backlog') {
        setWorkOrders(prev => prev.filter(w => w._id !== id));
        setBacklogOrders(prev => [res.data, ...prev]);
      } else {
        setWorkOrders(prev => {
          const exists = prev.some(w => w._id === id);
          if (exists) return prev.map(w => w._id === id ? res.data : w);
          return [res.data, ...prev];
        });
        setBacklogOrders(prev => prev.filter(w => w._id !== id));
      }
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteWorkOrder(confirmDelete._id);
      setWorkOrders(prev => prev.filter(w => w._id !== confirmDelete._id));
      setArchivedOrders(prev => prev.filter(w => w._id !== confirmDelete._id));
      setBacklogOrders(prev => prev.filter(w => w._id !== confirmDelete._id));
      toast.success('Deleted');
    } catch (err) { toast.error(err.message); }
  };

  const handleCopy = async (wo) => {
    try {
      const notesRes = await getWorkOrderNotes(wo._id);
      const notes = notesRes.data || [];
      let text = `Work Order: ${wo.title}\n`;
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

  // Swipe-to-move handlers
  const handleTouchStart = useCallback((e, id) => {
    e.stopPropagation();
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchLocked.current = false;
    setSwipingId(id);
    setSwipeX(0);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!swipingId) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (!touchLocked.current) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        setSwipingId(null);
        setSwipeX(0);
        return;
      }
      if (Math.abs(dx) > 10) touchLocked.current = true;
    }
    if (touchLocked.current) {
      e.preventDefault();
      setSwipeX(Math.max(-120, Math.min(120, dx)));
    }
  }, [swipingId]);

  const handleTouchEnd = useCallback((e) => {
    if (e) e.stopPropagation();
    if (!swipingId) return;
    const wo = workOrders.find(w => w._id === swipingId);
    if (wo) {
      const colIdx = COLUMNS.indexOf(wo.status);
      if (swipeX > 70 && colIdx < COLUMNS.length - 1) {
        setSwipeConfirm({ id: swipingId, newStatus: COLUMNS[colIdx + 1] });
      } else if (swipeX < -70 && colIdx > 0) {
        setSwipeConfirm({ id: swipingId, newStatus: COLUMNS[colIdx - 1] });
      }
    }
    setSwipingId(null);
    setSwipeX(0);
  }, [swipingId, swipeX, workOrders]);

  const getColumnOrders = (status) => workOrders.filter(w => w.status === status);
  const totalActive = workOrders.filter(w => w.status !== 'backlog').length;

  // Render a single card
  const renderCard = (wo, colName) => {
    const isSwiping = swipingId === wo._id;
    const colIdx = COLUMNS.indexOf(colName);
    const canLeft = colIdx > 0;
    const canRight = colIdx < COLUMNS.length - 1;
    const cardDueColor = wo.status !== 'done' ? getDueDateColor(wo.dueDate, dueDateColors) : null;
    const colColor = COLUMN_COLORS[colName];

    const swipeBg = swipeX > 30
      ? (canRight ? COLUMN_COLORS[COLUMNS[colIdx + 1]] : 'var(--text-muted)')
      : swipeX < -30
        ? (canLeft ? COLUMN_COLORS[COLUMNS[colIdx - 1]] : 'var(--text-muted)')
        : 'transparent';

    const swipeLabel = swipeX > 50
      ? (canRight ? STATUS_LABELS[COLUMNS[colIdx + 1]] : '')
      : swipeX < -50
        ? (canLeft ? STATUS_LABELS[COLUMNS[colIdx - 1]] : '')
        : '';

    return (
      <div key={wo._id} style={{ position: 'relative', marginBottom: 10 }}>
        {/* Swipe background indicator */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 14, background: swipeBg,
          display: 'flex', alignItems: 'center',
          justifyContent: swipeX > 0 ? 'flex-end' : 'flex-start',
          padding: '0 18px',
          opacity: isSwiping ? Math.min(Math.abs(swipeX) / 80, 1) : 0,
          transition: isSwiping ? 'none' : 'opacity 0.3s ease',
        }}>
          <span style={{
            color: '#fff', fontWeight: 700, fontSize: 12,
            textTransform: 'uppercase', letterSpacing: '0.03em',
          }}>{swipeLabel}</span>
        </div>

        {/* Card */}
        <div
          onTouchStart={(e) => handleTouchStart(e, wo._id)}
          onTouchMove={handleTouchMove}
          onTouchEnd={(e) => handleTouchEnd(e)}
          onClick={() => !touchLocked.current && setDetailId(wo._id)}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: isSwiping
              ? '0 8px 24px rgba(0,0,0,0.25)'
              : '0 2px 8px rgba(0,0,0,0.1)',
            transform: isSwiping ? `translateX(${swipeX}px) scale(1.02)` : 'translateX(0)',
            transition: isSwiping ? 'box-shadow 0.2s' : 'all 0.35s cubic-bezier(0.25,0.46,0.45,0.94)',
            borderLeft: `4px solid ${cardDueColor || colColor}`,
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'pan-y',
            position: 'relative',
          }}
        >
          {/* Title + Priority + Lock */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <p style={{
              fontSize: 14, fontWeight: 600, lineHeight: 1.3, flex: 1, marginRight: 8, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {wo.locked && <IoLockClosed size={11} color="var(--warning)" style={{ marginRight: 4, verticalAlign: -1 }} />}
              {wo.title}
            </p>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '3px 8px',
              borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              background: PRIORITY_COLORS[wo.priority] + '20',
              color: PRIORITY_COLORS[wo.priority],
            }}>{wo.priority}</span>
          </div>

          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
            {wo.budgetId && (
              <span style={{
                fontSize: 9, fontWeight: 600,
                background: '#3AAFB920', color: '#3AAFB9',
                padding: '2px 6px', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
                <IoWallet size={9} /> {formatPKR(wo.budgetAmount)}
              </span>
            )}
            {wo.budgetId && wo.budgetExpenseStatus === 'completed' && (
              <span style={{
                fontSize: 9, fontWeight: 600, background: '#22C55E20', color: '#22C55E',
                padding: '2px 6px', borderRadius: 10,
              }}>Logged</span>
            )}
            {wo.budgetId && wo.budgetExpenseStatus !== 'none' && wo.budgetExpenseStatus !== 'completed' && (
              <span style={{
                fontSize: 9, fontWeight: 600,
                background: wo.budgetExpenseStatus === 'failed' ? '#EF444420' : '#F59E0B20',
                color: wo.budgetExpenseStatus === 'failed' ? '#EF4444' : '#F59E0B',
                padding: '2px 6px', borderRadius: 10,
              }}>
                {wo.budgetExpenseStatus === 'pending' ? 'Pending' : 'Failed'}
              </span>
            )}
            {wo.dueDate && (
              <span style={{
                fontSize: 9, fontWeight: 600,
                background: (cardDueColor || 'var(--text-muted)') + '20',
                color: cardDueColor || 'var(--text-muted)',
                padding: '2px 6px', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
                <IoCalendar size={8} /> Due: {formatDate(wo.dueDate)}
              </span>
            )}
          </div>

          {/* Created date */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
            Created: {formatDateTime(wo.createdAt)}
          </div>

          {/* Quick actions row */}
          <div style={{
            display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {/* Quick status change */}
              <div style={{ position: 'relative' }}>
                <button className="btn-ghost"
                  onClick={(e) => {
                    if (quickStatusId === wo._id) {
                      setQuickStatusId(null);
                      setQuickStatusPos(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setQuickStatusPos({ top: rect.bottom + 4, left: rect.left, colName });
                      setQuickStatusId(wo._id);
                    }
                  }}
                  style={{
                    background: COLUMN_COLORS[colName] + '18',
                    border: 'none', borderRadius: 10, padding: '5px 10px',
                    fontSize: 10, fontWeight: 700, color: COLUMN_COLORS[colName],
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                  {STATUS_LABELS[colName]} <IoChevronDown size={9} />
                </button>
              </div>
              {/* Quick budget edit for budget-linked WOs */}
              {wo.budgetId && (
                <button className="btn-ghost"
                  onClick={() => {
                    setQuickBudgetWo(wo);
                    setQuickBudgetId(wo.budgetId?._id || wo.budgetId || '');
                    setQuickBudgetAmount(wo.budgetAmount || '');
                    getBudgets().then(res => setQuickBudgetBudgets(res.data)).catch(() => {});
                  }}
                  style={{
                    background: '#3AAFB918', border: 'none', borderRadius: 10, padding: '5px 10px',
                    fontSize: 10, fontWeight: 700, color: '#3AAFB9',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                  <IoWallet size={10} /> {formatPKR(wo.budgetAmount)}
                </button>
              )}
              {colName === 'done' && (
                <button className="btn-ghost"
                  onClick={() => handleArchive(wo._id)}
                  style={{
                    background: '#6B728018', border: 'none', borderRadius: 10, padding: '5px 10px',
                    fontSize: 10, fontWeight: 700, color: '#6B7280',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                  <IoArchive size={10} /> Archive
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="btn-ghost" style={{ padding: 4 }} onClick={() => handleCopy(wo)}>
                <IoCopy size={12} color="var(--text-muted)" />
              </button>
              {!wo.locked && (
                <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setConfirmDelete(wo)}>
                  <IoTrash size={12} color="var(--danger)" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Column tab swipe (isolated: stopPropagation prevents parent tab switch)
  const colTouchStart = useRef(null);
  const colTouchStartY = useRef(null);
  const handleColTouchStart = useCallback((e) => {
    e.stopPropagation();
    colTouchStart.current = e.changedTouches[0].clientX;
    colTouchStartY.current = e.changedTouches[0].clientY;
  }, []);
  const handleColTouchEnd = useCallback((e) => {
    e.stopPropagation();
    if (colTouchStart.current === null) return;
    const diffX = colTouchStart.current - e.changedTouches[0].clientX;
    const diffY = colTouchStartY.current - e.changedTouches[0].clientY;
    colTouchStart.current = null;
    colTouchStartY.current = null;
    if (Math.abs(diffX) < 50 || Math.abs(diffY) > Math.abs(diffX)) return;
    const idx = COLUMNS.indexOf(activeTab);
    if (diffX > 0 && idx < COLUMNS.length - 1) setActiveTab(COLUMNS[idx + 1]);
    else if (diffX < 0 && idx > 0) setActiveTab(COLUMNS[idx - 1]);
  }, [activeTab]);

  // Quick budget save handler
  const handleQuickBudgetSave = async () => {
    if (!quickBudgetWo || quickBudgetSaving) return;
    setQuickBudgetSaving(true);
    try {
      const data = {
        budgetId: quickBudgetId || null,
        budgetAmount: quickBudgetId ? parseFloat(quickBudgetAmount) || 0 : 0,
      };
      const res = await updateWorkOrder(quickBudgetWo._id, data);
      setWorkOrders(prev => prev.map(w => w._id === quickBudgetWo._id ? res.data : w));
      setQuickBudgetWo(null);
      toast.success('Budget updated');
    } catch (err) { toast.error(err.message); }
    finally { setQuickBudgetSaving(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div onClick={() => { if (quickStatusId) { setQuickStatusId(null); setQuickStatusPos(null); } }}>
      {/* Header row: search, filter, view toggle, add */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        {searchMode ? (
          <input ref={searchRef} type="text" placeholder="Search work orders..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, fontSize: 13 }} autoFocus />
        ) : (
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)' }}>
            {totalActive} task{totalActive !== 1 ? 's' : ''} · Swipe to move
          </div>
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

        {/* View Toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-input)', borderRadius: 10,
          padding: 2,
        }}>
          <button className="btn-ghost" onClick={() => setViewMode('tabs')}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', padding: 0,
              background: viewMode === 'tabs' ? 'var(--bg-card)' : 'transparent',
              boxShadow: viewMode === 'tabs' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <IoGrid size={14} color={viewMode === 'tabs' ? 'var(--text)' : 'var(--text-muted)'} />
          </button>
          <button className="btn-ghost" onClick={() => setViewMode('list')}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', padding: 0,
              background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
              boxShadow: viewMode === 'list' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <IoList size={16} color={viewMode === 'list' ? 'var(--text)' : 'var(--text-muted)'} />
          </button>
        </div>

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

      {/* Summary Progress Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {COLUMNS.map(c => {
          const count = getColumnOrders(c).length;
          const pct = totalActive > 0 ? (count / totalActive) * 100 : 0;
          return (
            <div key={c} style={{ flex: 1 }}>
              <div style={{
                height: 4, borderRadius: 4, background: COLUMN_COLORS[c] + '20',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: COLUMN_COLORS[c], borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab View */}
      {viewMode === 'tabs' && (
        <>
          {/* Column Tabs (swipeable) */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}
            onTouchStart={handleColTouchStart} onTouchEnd={handleColTouchEnd}>
            {COLUMNS.map(c => {
              const active = c === activeTab;
              const count = getColumnOrders(c).length;
              const color = COLUMN_COLORS[c];
              return (
                <button key={c} onClick={() => setActiveTab(c)}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: 12,
                    border: active ? `2px solid ${color}` : '2px solid transparent',
                    background: active ? color + '15' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: active ? color : 'var(--text-muted)',
                    transition: 'all 0.3s ease',
                  }} />
                  <span style={{
                    fontWeight: active ? 700 : 500, fontSize: 12,
                    color: active ? color : 'var(--text-muted)',
                    transition: 'all 0.3s ease',
                  }}>{STATUS_LABELS[c]}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: active ? color : 'var(--text-muted)',
                    background: active ? color + '20' : 'transparent',
                    padding: '1px 8px', borderRadius: 10,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Bulk archive for done tab */}
          {activeTab === 'done' && getColumnOrders('done').length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button className="btn-ghost" onClick={handleBulkArchive}
                style={{
                  padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                  color: '#6B7280', background: '#6B728015', borderRadius: 8,
                }}>
                <IoArchive size={12} /> Archive All Done
              </button>
            </div>
          )}

          {/* Cards */}
          <div>
            {getColumnOrders(activeTab).length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13,
              }}>
                No tasks here yet
              </div>
            ) : (
              getColumnOrders(activeTab).map(wo => renderCard(wo, activeTab))
            )}
          </div>
        </>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div>
          {COLUMNS.map(colName => {
            const columnTasks = getColumnOrders(colName);
            const color = COLUMN_COLORS[colName];
            return (
              <div key={colName} style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 10, paddingBottom: 6,
                  borderBottom: `2px solid ${color}30`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: color,
                  }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {STATUS_LABELS[colName]}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color,
                    background: color + '20', padding: '2px 8px', borderRadius: 10,
                  }}>{columnTasks.length}</span>
                  {colName === 'done' && columnTasks.length > 0 && (
                    <button className="btn-ghost" onClick={handleBulkArchive}
                      style={{ marginLeft: 'auto', padding: '2px 6px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: '#6B7280' }}>
                      <IoArchive size={11} /> Archive All
                    </button>
                  )}
                </div>
                {columnTasks.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12,
                  }}>Empty</div>
                ) : (
                  columnTasks.map(wo => renderCard(wo, colName))
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Backlog Section */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowBacklog(!showBacklog)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, cursor: 'pointer', color: 'var(--text-secondary)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IoList size={14} color="#6B7280" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Backlog</span>
            <span style={{
              fontSize: 10, fontWeight: 600, background: '#6B728020',
              color: '#6B7280', padding: '2px 8px', borderRadius: 10,
            }}>
              {backlogOrders.length}
            </span>
          </div>
          {showBacklog ? <IoChevronUp size={14} /> : <IoChevronDown size={14} />}
        </button>

        {showBacklog && (
          <div style={{ marginTop: 8 }}>
            {/* Backlog action bar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => setShowBacklogCreate(true)}
                style={{ padding: '6px 12px', fontSize: 11, width: 'auto', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8 }}>
                <IoAdd size={14} /> Add to Backlog
              </button>
              {backlogSelected.length > 0 && (
                <>
                  <button className="btn-ghost" onClick={async () => {
                    try {
                      await bulkMoveWorkOrders(backlogSelected, 'todo');
                      setBacklogSelected([]);
                      toast.success(`Moved ${backlogSelected.length} to Todo`);
                      refresh();
                    } catch (err) { toast.error(err.message); }
                  }}
                    style={{
                      padding: '6px 12px', fontSize: 11, borderRadius: 8,
                      background: '#3AAFB918', color: '#3AAFB9', fontWeight: 600,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                    Move {backlogSelected.length} to Todo
                  </button>
                  <button className="btn-ghost" onClick={() => setBacklogSelected([])}
                    style={{ padding: '6px 8px', fontSize: 11, borderRadius: 8 }}>
                    <IoClose size={14} />
                  </button>
                </>
              )}
              {backlogOrders.length > 0 && backlogSelected.length === 0 && (
                <button className="btn-ghost" onClick={() => setBacklogSelected(backlogOrders.map(w => w._id))}
                  style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, color: 'var(--text-muted)' }}>
                  Select All
                </button>
              )}
            </div>

            {backlogOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                No items in backlog — plan ahead by adding items here
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
                {backlogOrders.map(wo => (
                  <div key={wo._id}
                    style={{
                      background: 'var(--bg-card)', borderRadius: 12,
                      padding: '10px 12px', cursor: 'pointer',
                      borderLeft: `4px solid #6B7280`,
                      border: backlogSelected.includes(wo._id) ? '2px solid #6B7280' : '1px solid var(--border)',
                      borderLeftWidth: 4,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Selection checkbox */}
                      <input type="checkbox" checked={backlogSelected.includes(wo._id)}
                        onChange={e => {
                          if (e.target.checked) setBacklogSelected(prev => [...prev, wo._id]);
                          else setBacklogSelected(prev => prev.filter(id => id !== wo._id));
                        }}
                        style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }} onClick={() => setDetailId(wo._id)}>
                        <p style={{
                          fontSize: 13, fontWeight: 600, marginBottom: 2, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {wo.title}
                        </p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            background: PRIORITY_COLORS[wo.priority] + '20',
                            color: PRIORITY_COLORS[wo.priority],
                            padding: '2px 6px', borderRadius: 10,
                          }}>
                            {wo.priority}
                          </span>
                          {wo.dueDate && (
                            <span style={{ fontSize: 9, color: getDueDateColor(wo.dueDate, dueDateColors) || 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                              <IoCalendar size={8} /> Due: {formatDate(wo.dueDate)}
                            </span>
                          )}
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                            Created: {formatDateTime(wo.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {/* Move to Todo */}
                        <button className="btn-ghost" style={{ padding: 4 }} title="Move to Todo"
                          onClick={async () => {
                            try {
                              await moveWorkOrder(wo._id, 'todo');
                              toast.success('Moved to Todo');
                              refresh();
                            } catch (err) { toast.error(err.message); }
                          }}>
                          <IoChevronForward size={14} color="#3AAFB9" />
                        </button>
                        {/* Duplicate */}
                        <button className="btn-ghost" style={{ padding: 4 }} title="Duplicate"
                          onClick={() => { setDuplicateWo(wo); setDuplicateCount(1); }}>
                          <IoCopy size={13} color="var(--text-muted)" />
                        </button>
                        {/* Delete */}
                        <button className="btn-ghost" style={{ padding: 4 }}
                          onClick={() => setConfirmDelete(wo)}>
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
      </div>

      {/* Archived Section */}
      {archivedOrders.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setShowArchived(!showArchived)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, cursor: 'pointer', color: 'var(--text-secondary)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IoArchive size={14} color="#6B7280" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Archived</span>
              <span style={{
                fontSize: 10, fontWeight: 600, background: '#6B728020',
                color: '#6B7280', padding: '2px 8px', borderRadius: 10,
              }}>
                {archivedOrders.length}
              </span>
            </div>
            {showArchived ? <IoChevronUp size={14} /> : <IoChevronDown size={14} />}
          </button>

          {showArchived && (
            <div style={{ marginTop: 8, display: 'grid', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {archivedOrders.map(wo => (
                <div key={wo._id} onClick={() => setDetailId(wo._id)}
                  style={{
                    background: 'var(--bg-card)', borderRadius: 14,
                    padding: '12px 14px', cursor: 'pointer',
                    borderLeft: '4px solid #6B7280',
                    opacity: 0.7,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, marginBottom: 4, margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {wo.title}
                      </p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          background: PRIORITY_COLORS[wo.priority] + '20',
                          color: PRIORITY_COLORS[wo.priority],
                          padding: '2px 6px', borderRadius: 10,
                        }}>
                          {wo.priority}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          Created: {formatDateTime(wo.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn-ghost" style={{ padding: 4 }} title="Unarchive"
                        onClick={() => handleUnarchive(wo._id)}>
                        <IoArrowUndo size={14} color="var(--primary)" />
                      </button>
                      <button className="btn-ghost" style={{ padding: 4 }}
                        onClick={() => setConfirmDelete(wo)}>
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

      {/* Swipe Move Confirmation */}
      {swipeConfirm && (() => {
        const wo = workOrders.find(w => w._id === swipeConfirm.id);
        const newColor = COLUMN_COLORS[swipeConfirm.newStatus];
        return (
          <div style={modalBackdrop} onClick={() => setSwipeConfirm(null)}>
            <div style={{ ...modalContent, textAlign: 'center', padding: 28 }} onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                Move to {STATUS_LABELS[swipeConfirm.newStatus]}?
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                &quot;{wo?.title?.slice(0, 60)}{wo?.title?.length > 60 ? '...' : ''}&quot;
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setSwipeConfirm(null)}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
                    border: '2px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}>
                  No
                </button>
                <button onClick={() => {
                  handleMove(swipeConfirm.id, swipeConfirm.newStatus);
                  setSwipeConfirm(null);
                }}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
                    border: 'none', background: newColor, color: '#fff', cursor: 'pointer',
                  }}>
                  Yes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick Status Dropdown (fixed, outside card stacking context) */}
      {quickStatusId && quickStatusPos && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
          onClick={() => { setQuickStatusId(null); setQuickStatusPos(null); }}>
          <div style={{
            position: 'fixed', top: quickStatusPos.top, left: quickStatusPos.left,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            minWidth: 120, zIndex: 101,
          }} onClick={e => e.stopPropagation()}>
            {['backlog', ...COLUMNS, 'archived'].filter(s => s !== quickStatusPos.colName).map(s => (
              <button key={s} onClick={() => {
                if (s === 'archived') handleArchive(quickStatusId);
                else handleMove(quickStatusId, s);
                setQuickStatusId(null);
                setQuickStatusPos(null);
              }} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: COLUMN_COLORS[s] || '#6B7280',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLUMN_COLORS[s] || '#6B7280' }} />
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Budget Edit Modal */}
      {quickBudgetWo && (
        <div style={modalBackdrop} onClick={() => setQuickBudgetWo(null)}>
          <div style={{ ...modalContent, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Quick Budget Edit</h3>
              <button className="btn-ghost" onClick={() => setQuickBudgetWo(null)} style={{ padding: 4 }}><IoClose size={18} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              {quickBudgetWo.title}
            </p>
            <div className="form-group">
              <label style={{ fontSize: 13 }}>Budget</label>
              <select value={quickBudgetId} onChange={e => setQuickBudgetId(e.target.value)} style={{ fontSize: 13 }}>
                <option value="">No budget</option>
                {quickBudgetBudgets.map(b => (
                  <option key={b._id} value={b._id}>{b.name} ({formatPKR(b.remainingAmount)})</option>
                ))}
              </select>
            </div>
            {quickBudgetId && (
              <div className="form-group">
                <label style={{ fontSize: 13 }}>Amount (PKR)</label>
                <input type="number" value={quickBudgetAmount} onChange={e => setQuickBudgetAmount(e.target.value)}
                  min="0" step="0.01" style={{ fontSize: 14 }} />
              </div>
            )}
            <button className="btn-primary" onClick={handleQuickBudgetSave} disabled={quickBudgetSaving}
              style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
              {quickBudgetSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateWo && (
        <div style={modalBackdrop} onClick={() => setDuplicateWo(null)}>
          <div style={{ ...modalContent, textAlign: 'center', padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Duplicate Work Order</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              &quot;{duplicateWo.title.slice(0, 60)}&quot;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Copies:</label>
              <input type="number" min="1" max="50" value={duplicateCount}
                onChange={e => setDuplicateCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                style={{ width: 70, textAlign: 'center', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDuplicateWo(null)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}>Cancel</button>
              <button onClick={async () => {
                try {
                  await duplicateWorkOrder(duplicateWo._id, duplicateCount);
                  toast.success(`Duplicated ${duplicateCount}x`);
                  setDuplicateWo(null);
                  refresh();
                } catch (err) { toast.error(err.message); }
              }}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer',
                }}>Duplicate</button>
            </div>
          </div>
        </div>
      )}

      {/* Backlog Create Modal */}
      {showBacklogCreate && (
        <CreateWorkOrderModal
          onClose={() => setShowBacklogCreate(false)}
          onCreated={(wo) => {
            // Move the created work order to backlog
            moveWorkOrder(wo._id, 'backlog').then(() => {
              setShowBacklogCreate(false);
              refresh();
            }).catch(err => toast.error(err.message));
          }}
          isBacklog
        />
      )}
    </div>
  );
}

// ──────────────────────── Create Modal ────────────────────────

function CreateWorkOrderModal({ onClose, onCreated, isBacklog }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [isBudget, setIsBudget] = useState(false);
  const [budgetId, setBudgetId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [priceItems, setPriceItems] = useState([]);
  const [showPriceSuggestions, setShowPriceSuggestions] = useState(false);
  const [selectedPriceItem, setSelectedPriceItem] = useState(null);
  const titleRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    getBudgets().then(res => setBudgets(res.data)).catch(() => {});
    getPriceItems().then(res => setPriceItems(res.data || [])).catch(() => {});
  }, []);

  const filteredPriceItems = priceItems.filter(item =>
    !title.trim() || item.name.toLowerCase().includes(title.toLowerCase())
  );

  const handleSelectPriceItem = (item) => {
    setTitle(item.name);
    setSelectedPriceItem(item);
    setShowPriceSuggestions(false);
    setIsBudget(true);
    if (item.latestPrice) {
      setBudgetAmount(String(item.latestPrice.amount || ''));
    }
  };

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    setShowPriceSuggestions(true);
    if (selectedPriceItem && e.target.value !== selectedPriceItem.name) {
      setSelectedPriceItem(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          titleRef.current && !titleRef.current.contains(e.target)) {
        setShowPriceSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{isBacklog ? 'Add to Backlog' : 'New Work Order'}</h3>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><IoClose size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Title</label>
            <input ref={titleRef} type="text" value={title} onChange={handleTitleChange}
              onFocus={() => setShowPriceSuggestions(true)}
              placeholder="Work order title" autoFocus />
            {showPriceSuggestions && filteredPriceItems.length > 0 && (
              <div ref={suggestionsRef} style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', maxHeight: 180, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {filteredPriceItems.map(item => (
                  <div key={item._id} onClick={() => handleSelectPriceItem(item)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span>{item.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({item.category})</span></span>
                    {item.latestPrice && (
                      <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                        {formatPKR(item.latestPrice.amount)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
            {saving ? 'Creating...' : isBacklog ? 'Add to Backlog' : 'Create Work Order'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────── Detail Modal ────────────────────────

function WorkOrderDetailModal({ workOrderId, onClose, onDeleted }) {
  const { settings } = useSettings();
  const [wo, setWo] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const detailSwipe = useSwipeTabs(['info', 'notes', 'reminders'], tab, setTab, undefined, settings?.tabSwipeTrail !== false);
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
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [richEditorOpen, setRichEditorOpen] = useState(false);
  const [richEditorContent, setRichEditorContent] = useState('');
  const [richEditorSaving, setRichEditorSaving] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(null);

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
  const handleSaveNote = async (htmlContent) => {
    if (!htmlContent?.trim() || !stripHtml(htmlContent).trim()) return;
    setRichEditorSaving(true);
    try {
      if (editingNoteId) {
        await updateWorkOrderNote(editingNoteId, { content: htmlContent });
        toast.success('Note updated');
      } else {
        await addWorkOrderNote(workOrderId, { content: htmlContent });
        toast.success('Note added');
      }
      setEditingNoteId(null);
      setRichEditorOpen(false);
      setRichEditorContent('');
      const notesRes = await getWorkOrderNotes(workOrderId);
      setNotes(notesRes.data);
    } catch (err) { toast.error(err.message); }
    finally { setRichEditorSaving(false); }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    setRichEditorContent(note.content);
    setRichEditorOpen(true);
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

  if (loading) return (
    <div style={modalBackdrop}><div style={modalContent}><Spinner /></div></div>
  );

  if (!wo) return null;

  const hasBudget = !!(wo.budgetId);
  const isDone = wo.status === 'done' || wo.status === 'archived';
  const showExpenseBtn = hasBudget && isDone && wo.budgetExpenseStatus !== 'completed';

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={{ ...modalContent, maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}
        onTouchStart={e => { e.stopPropagation(); detailSwipe.onTouchStart(e); }}
        onTouchEnd={e => { e.stopPropagation(); detailSwipe.onTouchEnd(e); }}>
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
                <span style={{ fontSize: 10, fontWeight: 600, background: '#3AAFB925', color: '#3AAFB9', padding: '2px 6px', borderRadius: 4 }}>
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
                {/* Lock toggle + Edit */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button className="btn-outline" onClick={async () => {
                    try {
                      const res = await updateWorkOrder(workOrderId, { locked: !wo.locked });
                      setWo(res.data);
                      toast.success(wo.locked ? 'Unlocked' : 'Locked');
                    } catch (err) { toast.error(err.message); }
                  }}
                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
                    {wo.locked ? <IoLockClosed size={14} color="var(--warning)" /> : <IoLockOpen size={14} />}
                    {wo.locked ? 'Unlock' : 'Lock'}
                  </button>
                  {!wo.locked && (
                    <button className="btn-outline" onClick={() => setEditing(true)}
                      style={{ flex: 1, fontSize: 12 }}>
                      <IoCreate size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Edit Details
                    </button>
                  )}
                </div>
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
                    {['backlog', ...COLUMNS, 'archived'].map(c => <option key={c} value={c}>{STATUS_LABELS[c]}</option>)}
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
                (async () => {
                  let text = `Work Order: ${wo2.title}\n`;
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
              {!wo.locked && (
                <button className="btn-danger" onClick={() => setConfirmDelete(true)} style={{ flex: 1, fontSize: 12 }}>
                  <IoTrash size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div>
            <button className="btn-primary" onClick={() => { setEditingNoteId(null); setRichEditorContent(''); setRichEditorOpen(true); }}
              style={{ width: '100%', marginBottom: 12, fontSize: 12 }}>
              <IoAdd size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Add Note
            </button>

            {/* Notes List */}
            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No notes yet</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {notes.map(note => (
                  <div key={note._id} className="card" style={{ padding: 10, cursor: 'pointer' }}
                    onClick={() => handleEditNote(note)}>
                    <div dangerouslySetInnerHTML={{ __html: note.content }}
                      style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, wordBreak: 'break-word' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {formatDateTime(note.createdAt)}
                        {note.updatedAt !== note.createdAt && (
                          <span> · edited {formatDateTime(note.updatedAt)}</span>
                        )}
                      </div>
                      <button className="btn-ghost" style={{ padding: 3 }}
                        onClick={e => { e.stopPropagation(); setConfirmDeleteNote(note._id); }}>
                        <IoTrash size={13} color="var(--danger)" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <RichTextEditor
              open={richEditorOpen}
              initialContent={richEditorContent}
              onSave={handleSaveNote}
              onClose={() => { setRichEditorOpen(false); setEditingNoteId(null); }}
              title={editingNoteId ? 'Edit Note' : 'New Note'}
              saving={richEditorSaving}
            />
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
                        <option value="once">Once</option>
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
                    {rem.type === 'once' && rem.fired && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>
                        Already fired
                      </div>
                    )}

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

        <ConfirmModal open={!!confirmDeleteNote} onClose={() => setConfirmDeleteNote(null)}
          onConfirm={() => { handleDeleteNote(confirmDeleteNote); setConfirmDeleteNote(null); }}
          title="Delete note?"
          message="Delete this note? This cannot be undone." />
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
