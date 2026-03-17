import { useState, useEffect, useRef } from 'react';
import useBackClose from '../hooks/useBackClose';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoCreate, IoRemove, IoRefresh, IoSearch, IoFilter, IoChevronForward } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import useSwipeTabs from '../hooks/useSwipeTabs';
import { useSettings } from '../context/SettingsContext';
import { formatDateTime } from '../utils/format';
import {
  getStockItems, createStockItem, updateStockItem, deleteStockItem,
  consumeStock, refillStock,
  getStockNotes, addStockNote, updateStockNote, deleteStockNote,
} from '../api';

const RICH_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', '#1A1A2E', '#F1F1F6'];
const UNIT_PRESETS = ['unit', 'tablet', 'strip', 'box', 'pack', 'piece', 'bottle', 'kg', 'g', 'liter', 'ml', 'pair'];
const STATUS_CONFIG = {
  in_stock: { label: 'In Stock', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  low: { label: 'Low', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  empty: { label: 'Empty', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

export default function StockList({ categoryNames, categoryColorMap }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  useBackClose(!!createModal, () => setCreateModal(false));
  useBackClose(!!detailItem, () => setDetailItem(null));

  const fetchItems = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getStockItems(params);
      setItems(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchItems();
  }, [search, statusFilter, categoryFilter]);

  const counts = {
    all: items.length,
    in_stock: items.filter(i => i.status === 'in_stock').length,
    low: items.filter(i => i.status === 'low').length,
    empty: items.filter(i => i.status === 'empty').length,
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <IoSearch size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
        <input type="text" placeholder="Search stock..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 32, width: '100%' }} />
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'in_stock', label: 'In Stock' },
          { key: 'low', label: 'Low' },
          { key: 'empty', label: 'Empty' },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap',
              background: statusFilter === f.key ? 'var(--primary)' : 'transparent',
              color: statusFilter === f.key ? 'white' : 'var(--text-muted)',
            }}>
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Category filter */}
      {categoryNames?.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            style={{ width: '100%', fontSize: 13 }}>
            <option value="all">All Categories</option>
            {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <EmptyState icon="📦" title="No stock items" subtitle="Tap + to add your first item" />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(item => {
            const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.in_stock;
            const catColor = categoryColorMap?.[item.category] || '#3AAFB9';
            return (
              <div key={item._id} className="card" style={{
                cursor: 'pointer', padding: '12px 14px',
                borderLeft: `3px solid ${catColor}`,
              }}
                onClick={() => setDetailItem(item)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</h3>
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        padding: '2px 6px', borderRadius: 4,
                        background: sc.bg, color: sc.color,
                      }}>{sc.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 600, color: item.currentStock <= 0 ? 'var(--danger)' : item.currentStock <= item.minStock ? 'var(--warning)' : 'var(--text-primary)' }}>
                        {item.currentStock} {item.unit}{item.currentStock !== 1 ? 's' : ''}
                      </span>
                      {item.minStock > 0 && <span>Min: {item.minStock}</span>}
                      <span style={{ color: catColor }}>{item.category}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {/* Quick consume button */}
                    {item.currentStock > 0 && (
                      <button className="btn-ghost" title="Quick consume 1"
                        style={{ padding: 6, color: 'var(--warning)' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await consumeStock(item._id, { quantity: 1 });
                            toast.success(`-1 ${item.unit}`);
                            fetchItems();
                          } catch (err) { toast.error(err.message); }
                        }}>
                        <IoRemove size={16} />
                      </button>
                    )}
                    <IoChevronForward size={16} color="var(--text-muted)" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => setCreateModal(true)}><IoAdd /></button>

      <CreateStockModal open={createModal} onClose={() => setCreateModal(false)}
        onDone={fetchItems} categoryNames={categoryNames} />

      {detailItem && (
        <StockDetailModal open={!!detailItem} item={detailItem}
          onClose={() => setDetailItem(null)} onDone={fetchItems}
          categoryNames={categoryNames} />
      )}
    </div>
  );
}

function CreateStockModal({ open, onClose, onDone, categoryNames }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('unit');
  const [currentStock, setCurrentStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createStockItem({
        name, category, unit,
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock) || 0,
      });
      toast.success('Stock item added');
      setName(''); setCategory('General'); setUnit('unit');
      setCurrentStock(''); setMinStock('');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Stock Item">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input type="text" placeholder="e.g., Panadol, Pampers, Rice" value={name}
            onChange={e => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {(categoryNames || ['General']).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Unit Type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {UNIT_PRESETS.map(u => (
              <button key={u} type="button" onClick={() => setUnit(u)}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: unit === u ? 'var(--primary)' : 'transparent',
                  color: unit === u ? 'white' : 'var(--text-muted)',
                }}>
                {u}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Custom unit name" value={unit}
            onChange={e => setUnit(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Initial Stock</label>
            <input type="number" placeholder="0" value={currentStock} min="0"
              onChange={e => setCurrentStock(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Low Alert At</label>
            <input type="number" placeholder="0" value={minStock} min="0"
              onChange={e => setMinStock(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding...' : 'Add Item'}
        </button>
      </form>
    </Modal>
  );
}

function StockDetailModal({ open, item, onClose, onDone, categoryNames }) {
  const { settings: detailSettings } = useSettings();
  const [current, setCurrent] = useState(item);
  const [tab, setTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(null);
  const [consumeQty, setConsumeQty] = useState(1);
  const [refillQty, setRefillQty] = useState(1);
  const [showRefill, setShowRefill] = useState(false);

  // Notes state
  const [notes, setNotes] = useState([]);
  const [notesFetched, setNotesFetched] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const noteEditorRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#3AAFB9');

  const detailSwipe = useSwipeTabs(['info', 'notes', 'history'], tab, setTab, undefined, detailSettings?.tabSwipeBudget !== false);

  useEffect(() => {
    if (item) {
      setCurrent(item);
      setEditName(item.name);
      setEditCategory(item.category);
      setEditUnit(item.unit);
      setEditMinStock(item.minStock || 0);
    }
  }, [item]);

  const refreshItem = async () => {
    try {
      const res = await getStockItems({});
      const found = res.data.find(i => i._id === current._id);
      if (found) setCurrent(found);
    } catch {}
  };

  const fetchNotes = async () => {
    try {
      const res = await getStockNotes(current._id);
      setNotes(res.data);
      setNotesFetched(true);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    if (open && tab === 'notes' && !notesFetched) fetchNotes();
  }, [tab, open]);

  const handleConsume = async () => {
    try {
      const res = await consumeStock(current._id, { quantity: consumeQty });
      setCurrent(prev => ({ ...prev, ...res.data, status: res.data.currentStock <= 0 ? 'empty' : res.data.currentStock <= res.data.minStock ? 'low' : 'in_stock' }));
      toast.success(`Consumed ${consumeQty} ${current.unit}${consumeQty > 1 ? 's' : ''}`);
      setConsumeQty(1);
      onDone();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  };

  const handleRefill = async () => {
    try {
      const res = await refillStock(current._id, { quantity: refillQty });
      setCurrent(prev => ({ ...prev, ...res.data, status: res.data.currentStock <= 0 ? 'empty' : res.data.currentStock <= res.data.minStock ? 'low' : 'in_stock' }));
      toast.success(`Refilled ${refillQty} ${current.unit}${refillQty > 1 ? 's' : ''}`);
      setRefillQty(1);
      setShowRefill(false);
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveEdit = async () => {
    try {
      await updateStockItem(current._id, {
        name: editName, category: editCategory, unit: editUnit,
        minStock: Number(editMinStock) || 0,
      });
      toast.success('Updated');
      setEditing(false);
      refreshItem();
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    try {
      await deleteStockItem(current._id);
      toast.success('Deleted');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleAddNote = async () => {
    const content = noteEditorRef.current?.innerHTML;
    if (!content?.trim() || !stripHtml(content).trim()) return;
    try {
      if (editingNoteId) {
        await updateStockNote(editingNoteId, { content });
        setEditingNoteId(null);
        toast.success('Note updated');
      } else {
        await addStockNote(current._id, { content });
        toast.success('Note added');
      }
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = '';
      const notesRes = await getStockNotes(current._id);
      setNotes(notesRes.data);
    } catch (err) { toast.error(err.message); }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    if (noteEditorRef.current) noteEditorRef.current.innerHTML = note.content;
    setTab('notes');
  };

  const handleDeleteNote = async () => {
    if (!confirmDeleteNote) return;
    try {
      await deleteStockNote(confirmDeleteNote);
      setNotes(prev => prev.filter(n => n._id !== confirmDeleteNote));
      toast.success('Note deleted');
    } catch (err) { toast.error(err.message); }
    setConfirmDeleteNote(null);
  };

  const execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val);
    noteEditorRef.current?.focus();
  };

  const handleClose = () => {
    setNotes([]); setNotesFetched(false); setTab('info');
    setEditingNoteId(null); setShowColorPicker(false);
    setEditing(false); setShowRefill(false);
    onClose();
  };

  const sc = STATUS_CONFIG[current?.status] || STATUS_CONFIG.in_stock;
  const logs = current?.logs ? [...current.logs].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

  return (
    <Modal open={open} onClose={handleClose} title={current?.name}>
      <div onTouchStart={e => { e.stopPropagation(); detailSwipe.onTouchStart(e); }} onTouchEnd={e => { e.stopPropagation(); detailSwipe.onTouchEnd(e); }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'info', label: 'Info' },
          { key: 'notes', label: `Notes${notes.length ? ` (${notes.length})` : ''}` },
          { key: 'history', label: `History${logs.length ? ` (${logs.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none',
              color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div>
          {/* Status badge */}
          <div style={{ marginBottom: 12 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8,
              background: sc.bg, color: sc.color,
            }}>{sc.label}</span>
          </div>

          {/* Stock level */}
          <div style={{
            padding: '16px', background: 'var(--bg-input)', borderRadius: 8, marginBottom: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: current?.currentStock <= 0 ? 'var(--danger)' : current?.currentStock <= current?.minStock ? 'var(--warning)' : 'var(--text-primary)' }}>
              {current?.currentStock ?? 0}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {current?.unit}{current?.currentStock !== 1 ? 's' : ''} remaining
              {current?.minStock > 0 && (
                <span> · Alert at {current.minStock}</span>
              )}
            </div>
          </div>

          {/* Consume controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button className="btn-outline" style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}
              onClick={() => setConsumeQty(q => Math.max(1, q - 1))}>−</button>
            <span style={{ fontSize: 20, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{consumeQty}</span>
            <button className="btn-outline" style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}
              onClick={() => setConsumeQty(q => Math.min(current?.currentStock || 1, q + 1))}>+</button>
            <button className="btn-primary" style={{ flex: 1 }}
              onClick={handleConsume} disabled={current?.currentStock <= 0}>
              <IoRemove size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Consume {consumeQty}
            </button>
          </div>

          {/* Refill */}
          {!showRefill ? (
            <button className="btn-outline" style={{ width: '100%', marginBottom: 12, color: 'var(--success)' }}
              onClick={() => setShowRefill(true)}>
              <IoRefresh size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Refill Stock
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <button className="btn-outline" style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}
                onClick={() => setRefillQty(q => Math.max(1, q - 1))}>−</button>
              <span style={{ fontSize: 20, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{refillQty}</span>
              <button className="btn-outline" style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}
                onClick={() => setRefillQty(q => q + 1)}>+</button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--success)' }}
                onClick={handleRefill}>
                <IoRefresh size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                Refill +{refillQty}
              </button>
              <button className="btn-ghost" style={{ padding: 8 }} onClick={() => setShowRefill(false)}>
                ✕
              </button>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn-outline" style={{ flex: 1 }}
              onClick={() => setEditing(!editing)}>
              <IoCreate size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button className="btn-danger" style={{ width: 'auto', padding: '10px 14px' }}
              onClick={() => setConfirmDelete(true)}>
              <IoTrash size={14} />
            </button>
          </div>

          {/* Edit form */}
          {editing && (
            <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                  {(categoryNames || ['General']).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Unit</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {UNIT_PRESETS.map(u => (
                    <button key={u} type="button" onClick={() => setEditUnit(u)}
                      style={{
                        padding: '3px 8px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
                        border: '1px solid var(--border)',
                        background: editUnit === u ? 'var(--primary)' : 'transparent',
                        color: editUnit === u ? 'white' : 'var(--text-muted)',
                      }}>
                      {u}
                    </button>
                  ))}
                </div>
                <input type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Low Stock Alert</label>
                <input type="number" value={editMinStock} min="0"
                  onChange={e => setEditMinStock(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          )}

          {/* Item info */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <div>Category: {current?.category}</div>
            <div>Unit: {current?.unit}</div>
            <div>Created: {formatDateTime(current?.createdAt)}</div>
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
              {editingNoteId ? 'Update Note' : 'Add Note'}
            </button>
          </div>

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
                    <button className="btn-ghost" style={{ padding: 3 }} onClick={e => { e.stopPropagation(); setConfirmDeleteNote(note._id); }}>
                      <IoTrash size={13} color="var(--danger)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No activity yet</div>
          ) : (
            <div style={{ display: 'grid', gap: 4 }}>
              {logs.map((log, i) => (
                <div key={log._id || i} style={{
                  padding: '8px 12px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: 4, marginRight: 8,
                      background: log.type === 'consume' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                      color: log.type === 'consume' ? '#f59e0b' : '#22c55e',
                    }}>
                      {log.type === 'consume' ? '−' : '+'}{log.quantity}
                    </span>
                    <span style={{ fontSize: 13 }}>
                      {log.type === 'consume' ? 'Consumed' : 'Refilled'} {log.quantity} {current?.unit}{log.quantity > 1 ? 's' : ''}
                    </span>
                    {log.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{log.note}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.date)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete stock item?"
        message={`Delete "${current?.name}" and all its history? This cannot be undone.`} />
      <ConfirmModal open={!!confirmDeleteNote} onClose={() => setConfirmDeleteNote(null)}
        onConfirm={handleDeleteNote}
        title="Delete Note?"
        message="Delete this note? This cannot be undone." />
      </div>
    </Modal>
  );
}
