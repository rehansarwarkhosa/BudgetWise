import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  IoAdd, IoTrash, IoSearch, IoClose, IoFilter, IoPricetag, IoCreate,
  IoChevronDown, IoChevronUp, IoStorefront, IoTime,
} from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { formatPKR, formatDateTime, formatDate } from '../utils/format';
import {
  getPriceItems, createPriceItem, updatePriceItem, deletePriceItem,
  addPriceEntry, updatePriceEntry, deletePriceEntry, getBudgetCategories,
} from '../api';

export default function PriceList({ categoryColorMap: propColorMap }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryColorMap, setCategoryColorMap] = useState(propColorMap || {});
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    getBudgetCategories().then(res => {
      setCategories(res.data);
      const map = {};
      res.data.forEach(c => { map[c.name] = c.color || '#6C63FF'; });
      setCategoryColorMap(map);
    }).catch(() => {});
  }, []);

  const fetchItems = async (search, category) => {
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const res = await getPriceItems(params);
      setItems(res.data);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    fetchItems('', '').finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchItems(searchQuery, filterCategory);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, filterCategory]);

  const refresh = () => fetchItems(searchQuery, filterCategory);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePriceItem(confirmDelete._id);
      setItems(prev => prev.filter(i => i._id !== confirmDelete._id));
      toast.success('Deleted');
    } catch (err) { toast.error(err.message); }
  };

  // Group items by category
  const grouped = {};
  items.forEach(item => {
    const cat = item.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  const sortedCategories = Object.keys(grouped).sort();

  if (loading) return <Spinner />;

  return (
    <div>
      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        {searchMode ? (
          <input ref={searchRef} type="text" placeholder="Search products..."
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
          style={{ padding: 6, borderRadius: 8, background: filterCategory ? 'var(--primary)' + '30' : showFilters ? 'var(--bg-input)' : 'transparent' }}>
          <IoFilter size={18} />
        </button>
        <button className="btn-primary" onClick={() => setShowCreate(true)}
          style={{ padding: '6px 12px', fontSize: 13, width: 'auto' }}>
          <IoAdd size={16} />
        </button>
      </div>

      {showFilters && (
        <div className="card" style={{ padding: 10, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ flex: 1, fontSize: 12 }}>
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c._id} value={c.name}>{c.name}</option>
            ))}
          </select>
          {filterCategory && (
            <button className="btn-ghost" onClick={() => setFilterCategory('')}
              style={{ fontSize: 11, padding: '4px 8px' }}>Clear</button>
          )}
        </div>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <EmptyState icon="🏷️" title={searchMode || filterCategory ? "No results" : "No products yet"}
          subtitle={searchMode ? `Nothing found for "${searchQuery}"` : "Add your first product to track prices"} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sortedCategories.map(cat => (
            <div key={cat}>
              {/* Category Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                background: (categoryColorMap[cat] || '#6C63FF') + '15',
                borderLeft: `3px solid ${categoryColorMap[cat] || '#6C63FF'}`,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: categoryColorMap[cat] || '#6C63FF', flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: categoryColorMap[cat] || '#6C63FF' }}>
                  {cat}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {grouped[cat].length} item{grouped[cat].length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Item Cards */}
              <div style={{ display: 'grid', gap: 6 }}>
                {grouped[cat].map(item => (
                  <div key={item._id} className="card" onClick={() => setDetailId(item._id)}
                    style={{ padding: 10, cursor: 'pointer', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {item.latestPrice ? (
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                              {formatPKR(item.latestPrice.amount)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No price</span>
                          )}
                          {item.latestPrice?.store && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                              <IoStorefront size={10} /> {item.latestPrice.store}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, background: 'var(--bg-input)',
                          padding: '2px 6px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <IoTime size={10} /> {item.priceEntryCount} price{item.priceEntryCount !== 1 ? 's' : ''}
                        </span>
                        {item.latestPrice && (
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                            {formatDate(item.latestPrice.date)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price trend indicator */}
                    {item.priceHistory?.length >= 2 && (() => {
                      const curr = item.priceHistory[0].amount;
                      const prev = item.priceHistory[1].amount;
                      const diff = curr - prev;
                      if (diff === 0) return null;
                      const pct = ((diff / prev) * 100).toFixed(1);
                      return (
                        <div style={{
                          marginTop: 4, fontSize: 10, fontWeight: 600,
                          color: diff > 0 ? '#EF4444' : '#22C55E',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          {diff > 0 ? <IoChevronUp size={12} /> : <IoChevronDown size={12} />}
                          {diff > 0 ? '+' : ''}{formatPKR(diff)} ({diff > 0 ? '+' : ''}{pct}%)
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs previous</span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreatePriceItemModal
          categories={categories}
          categoryColorMap={categoryColorMap}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {/* Detail Modal */}
      {detailId && (
        <PriceItemDetailModal
          itemId={detailId}
          categories={categories}
          categoryColorMap={categoryColorMap}
          onClose={() => { setDetailId(null); refresh(); }}
          onDeleted={() => { setDetailId(null); refresh(); }}
        />
      )}

      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete product?"
        message={`Delete "${confirmDelete?.name}" and all its price history?`} />
    </div>
  );
}

// ──────────────────────── Create Modal ────────────────────────

function CreatePriceItemModal({ categories, categoryColorMap, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const data = { name: name.trim(), category };
      if (price) { data.price = parseFloat(price); data.store = store.trim(); }
      await createPriceItem(data);
      toast.success('Product added');
      onCreated();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalContent} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Add Product</h3>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><IoClose size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Baby Milk" autoFocus required />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Initial Price (PKR)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="e.g., 2400" min="0" step="0.01" />
          </div>
          <div className="form-group">
            <label>Store (optional)</label>
            <input type="text" value={store} onChange={e => setStore(e.target.value)}
              placeholder="e.g., Imtiaz, Naheed" />
          </div>
          <button type="submit" className="btn-primary" disabled={saving || !name.trim()}
            style={{ width: '100%', marginTop: 8 }}>
            {saving ? 'Adding...' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────── Detail Modal ────────────────────────

function PriceItemDetailModal({ itemId, categories, categoryColorMap, onClose, onDeleted }) {
  const [item, setItem] = useState(null);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Add price state
  const [newPrice, setNewPrice] = useState('');
  const [newStore, setNewStore] = useState('');
  const [addingPrice, setAddingPrice] = useState(false);

  // Edit price state
  const [editPriceId, setEditPriceId] = useState(null);
  const [editPriceAmount, setEditPriceAmount] = useState('');
  const [editPriceStore, setEditPriceStore] = useState('');

  useEffect(() => { loadItem(); }, [itemId]);

  const loadItem = async () => {
    try {
      const res = await getPriceItems({});
      const found = res.data.find(i => i._id === itemId);
      if (found) {
        setItem(found);
        setPrices(found.priceHistory || []);
        setEditName(found.name);
        setEditCategory(found.category);
      }
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleSaveItem = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updatePriceItem(itemId, { name: editName, category: editCategory });
      toast.success('Updated');
      setEditing(false);
      loadItem();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleAddPrice = async (e) => {
    e.preventDefault();
    if (!newPrice || addingPrice) return;
    setAddingPrice(true);
    try {
      await addPriceEntry(itemId, { amount: parseFloat(newPrice), store: newStore.trim() });
      toast.success('Price added');
      setNewPrice(''); setNewStore('');
      loadItem();
    } catch (err) { toast.error(err.message); }
    finally { setAddingPrice(false); }
  };

  const handleUpdatePrice = async (priceId) => {
    try {
      await updatePriceEntry(priceId, { amount: parseFloat(editPriceAmount), store: editPriceStore });
      toast.success('Price updated');
      setEditPriceId(null);
      loadItem();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeletePrice = async (priceId) => {
    try {
      await deletePriceEntry(priceId);
      setPrices(prev => prev.filter(p => p._id !== priceId));
      toast.success('Price deleted');
      loadItem();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteItem = async () => {
    try {
      await deletePriceItem(itemId);
      toast.success('Product deleted');
      onDeleted();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return (
    <div style={modalBackdrop}><div style={modalContent}><Spinner /></div></div>
  );
  if (!item) return null;

  const catColor = categoryColorMap[item.category] || '#6C63FF';

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={{ ...modalContent, maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            {!editing ? (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: catColor + '20', color: catColor,
                  }}>{item.category}</span>
                  {item.latestPrice && (
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                      {formatPKR(item.latestPrice.amount)}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Category</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                    {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" onClick={() => setEditing(false)} style={{ flex: 1, fontSize: 11 }}>Cancel</button>
                  <button className="btn-primary" onClick={handleSaveItem} disabled={saving} style={{ flex: 1, fontSize: 11 }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {!editing && (
              <button className="btn-ghost" onClick={() => setEditing(true)} style={{ padding: 4 }}>
                <IoCreate size={18} color="var(--text-muted)" />
              </button>
            )}
            <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}>
              <IoClose size={20} />
            </button>
          </div>
        </div>

        {/* Price trend summary */}
        {prices.length >= 2 && (() => {
          const curr = prices[0].amount;
          const prev = prices[1].amount;
          const diff = curr - prev;
          const oldest = prices[prices.length - 1].amount;
          const totalDiff = curr - oldest;
          return (
            <div className="card" style={{ padding: 8, marginBottom: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>vs Previous</span>
                <span style={{ fontWeight: 600, color: diff > 0 ? '#EF4444' : diff < 0 ? '#22C55E' : 'var(--text)' }}>
                  {diff > 0 ? '+' : ''}{formatPKR(diff)} ({diff > 0 ? '+' : ''}{((diff / prev) * 100).toFixed(1)}%)
                </span>
              </div>
              {prices.length > 2 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>vs First Record</span>
                  <span style={{ fontWeight: 600, color: totalDiff > 0 ? '#EF4444' : totalDiff < 0 ? '#22C55E' : 'var(--text)' }}>
                    {totalDiff > 0 ? '+' : ''}{formatPKR(totalDiff)} ({totalDiff > 0 ? '+' : ''}{((totalDiff / oldest) * 100).toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Add New Price */}
        <form onSubmit={handleAddPrice} style={{
          display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap',
          padding: 10, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
        }}>
          <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)}
            placeholder="New price" min="0" step="0.01" required
            style={{ flex: '1 1 100px', fontSize: 13 }} />
          <input type="text" value={newStore} onChange={e => setNewStore(e.target.value)}
            placeholder="Store (optional)"
            style={{ flex: '1 1 100px', fontSize: 13 }} />
          <button type="submit" className="btn-primary" disabled={addingPrice || !newPrice}
            style={{ padding: '8px 14px', fontSize: 12, width: 'auto' }}>
            <IoAdd size={14} />
          </button>
        </form>

        {/* Price History */}
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Price History ({prices.length})
          </h4>
          {prices.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No price entries</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {prices.map((p, idx) => (
                <div key={p._id} className="card" style={{
                  padding: 10,
                  ...(idx === 0 ? { borderLeft: '3px solid var(--primary)', background: 'var(--primary)' + '08' } : {}),
                }}>
                  {editPriceId === p._id ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input type="number" value={editPriceAmount}
                        onChange={e => setEditPriceAmount(e.target.value)}
                        style={{ flex: '1 1 80px', fontSize: 12 }} min="0" step="0.01" />
                      <input type="text" value={editPriceStore}
                        onChange={e => setEditPriceStore(e.target.value)}
                        placeholder="Store" style={{ flex: '1 1 80px', fontSize: 12 }} />
                      <button className="btn-primary" onClick={() => handleUpdatePrice(p._id)}
                        style={{ padding: '6px 10px', fontSize: 11, width: 'auto' }}>Save</button>
                      <button className="btn-ghost" onClick={() => setEditPriceId(null)}
                        style={{ padding: '6px 10px', fontSize: 11 }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>
                            {formatPKR(p.amount)}
                          </span>
                          {idx === 0 && (
                            <span style={{ fontSize: 9, fontWeight: 600, background: 'var(--primary)' + '25', color: 'var(--primary)', padding: '1px 5px', borderRadius: 4 }}>
                              LATEST
                            </span>
                          )}
                          {idx > 0 && (() => {
                            const diff = prices[idx - 1].amount - p.amount;
                            if (diff === 0) return null;
                            return (
                              <span style={{ fontSize: 9, fontWeight: 600, color: diff > 0 ? '#EF4444' : '#22C55E' }}>
                                {diff > 0 ? '↑' : '↓'} {formatPKR(Math.abs(diff))}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {formatDateTime(p.date)}
                          </span>
                          {p.store && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                              <IoStorefront size={9} /> {p.store}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button className="btn-ghost" style={{ padding: 3 }}
                          onClick={() => { setEditPriceId(p._id); setEditPriceAmount(p.amount); setEditPriceStore(p.store || ''); }}>
                          <IoCreate size={13} color="var(--text-muted)" />
                        </button>
                        <button className="btn-ghost" style={{ padding: 3 }} onClick={() => handleDeletePrice(p._id)}>
                          <IoTrash size={13} color="var(--danger)" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Item */}
        <button className="btn-danger" onClick={() => setConfirmDelete(true)}
          style={{ width: '100%', fontSize: 12, marginTop: 4 }}>
          <IoTrash size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Delete Product
        </button>

        <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)}
          onConfirm={handleDeleteItem}
          title="Delete product?"
          message={`Delete "${item.name}" and all ${prices.length} price entries?`} />
      </div>
    </div>
  );
}

// ──────────────────────── Helpers ────────────────────────

const modalBackdrop = {
  position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};

const modalContent = {
  background: 'var(--bg-card)', borderRadius: 'var(--radius)',
  padding: 20, width: '100%', maxWidth: 420,
  border: '1px solid var(--border)',
};
