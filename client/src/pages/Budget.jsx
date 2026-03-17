import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoWallet, IoCash, IoAddCircle, IoCreate, IoChevronUp, IoChevronDown, IoDocumentText, IoPlayCircle, IoBookmark, IoPricetag, IoCube, IoLockClosed, IoLockOpen } from 'react-icons/io5';
import PriceList from './PriceList';
import StockList from './StockList';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import useFetch from '../hooks/useFetch';
import useSwipeTabs from '../hooks/useSwipeTabs';

import { formatPKR, formatDate } from '../utils/format';
import { useSettings } from '../context/SettingsContext';
import {
  getIncomeSummary, getIncomes, addIncome, deleteIncome,
  getBudgets, createBudget, updateBudget, deleteBudget, addFundsToBudget,
  getExpenses, addExpense, updateExpense, deleteExpense,
  getFundEntries, deleteFundEntry, reorderBudget, getBudgetCategories,
  getBudgetTemplates, createBudgetTemplate, createTemplateFromBudgets,
  useBudgetTemplate, deleteBudgetTemplate, updateSettings,
} from '../api';

export default function Budget() {
  const { data: summary, loading: summaryLoading, refetch: refetchSummary } = useFetch(getIncomeSummary);
  const { data: budgets, loading: budgetsLoading, refetch: refetchBudgets } = useFetch(getBudgets);
  const { data: incomes, refetch: refetchIncomes } = useFetch(getIncomes);
  const { data: categoriesData } = useFetch(getBudgetCategories);
  const categoryNames = categoriesData?.map(c => c.name) || ['General'];
  const categoryColorMap = {};
  categoriesData?.forEach(c => { categoryColorMap[c.name] = c.color || '#3AAFB9'; });

  const { settings: appSettings, refetchSettings } = useSettings();
  const tabSwipeEnabled = appSettings?.tabSwipeBudget !== false;
  const budgetLocked = appSettings?.budgetLocked || false;
  const [activeView, _setActiveView] = useState(() => sessionStorage.getItem('budget_view') || 'budgets');
  const setActiveView = useCallback((v) => { _setActiveView(v); sessionStorage.setItem('budget_view', v); }, []);
  const mainSwipe = useSwipeTabs(['budgets', 'templates', 'prices', 'stock'], activeView, setActiveView, undefined, tabSwipeEnabled);
  const [incomeModal, setIncomeModal] = useState(false);
  const [budgetModal, setBudgetModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(null);
  const [fundsModal, setFundsModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [incomeListModal, setIncomeListModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refreshAll = () => {
    refetchSummary();
    refetchBudgets();
    refetchIncomes();
  };

  const handleToggleBudgetLock = async () => {
    try {
      await updateSettings({ budgetLocked: !budgetLocked });
      await refetchSettings();
      toast.success(budgetLocked ? 'Budgets unlocked' : 'Budgets locked');
    } catch (err) { toast.error(err.message); }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'budget') {
        await deleteBudget(confirmDelete.id);
        toast.success('Budget deleted');
      } else if (confirmDelete.type === 'income') {
        await deleteIncome(confirmDelete.id);
        toast.success('Income deleted');
      }
      refreshAll();
    } catch (err) { toast.error(err.message); }
  };

  const handleReorder = async (budgetId, direction) => {
    try {
      await reorderBudget(budgetId, direction);
      refetchBudgets();
    } catch (err) { toast.error(err.message); }
  };

  if ((summaryLoading && !summary) || (budgetsLoading && !budgets)) return <Spinner />;

  // Group budgets by category
  const grouped = {};
  budgets?.forEach((b) => {
    const cat = b.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(b);
  });
  const categories = Object.keys(grouped).sort();

  return (
    <div className="page" onTouchStart={mainSwipe.onTouchStart} onTouchEnd={mainSwipe.onTouchEnd}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Budget</h1>
        <button className="btn-ghost" onClick={handleToggleBudgetLock}
          style={{ padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: budgetLocked ? 'var(--warning)' : 'var(--text-muted)' }}>
          {budgetLocked ? <IoLockClosed size={16} /> : <IoLockOpen size={16} />}
        </button>
      </div>

      {/* View Toggle: Budgets / Templates */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        <button onClick={() => setActiveView('budgets')}
          style={{
            flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', color: activeView === 'budgets' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeView === 'budgets' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <IoWallet size={16} /> Budgets
        </button>
        <button onClick={() => setActiveView('templates')}
          style={{
            flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', color: activeView === 'templates' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeView === 'templates' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <IoBookmark size={16} /> Templates
        </button>
        <button onClick={() => setActiveView('prices')}
          style={{
            flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', color: activeView === 'prices' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeView === 'prices' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <IoPricetag size={16} /> Prices
        </button>
        <button onClick={() => setActiveView('stock')}
          style={{
            flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', color: activeView === 'stock' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeView === 'stock' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <IoCube size={16} /> Stock
        </button>
      </div>

      <div style={{ display: activeView === 'prices' ? 'block' : 'none' }}>
        <PriceList categoryNames={categoryNames} categoryColorMap={categoryColorMap} />
      </div>
      <div style={{ display: activeView === 'stock' ? 'block' : 'none' }}>
        <StockList categoryNames={categoryNames} categoryColorMap={categoryColorMap} />
      </div>
      <div style={{ display: activeView === 'budgets' ? 'block' : 'none' }}>
          {/* Income Summary Bar */}
          <div className="card" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => setIncomeListModal(true)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Income Pool</span>
              {!budgetLocked && (
                <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setIncomeModal(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontSize: 13 }}>
                  <IoAdd size={16} /> Add Income
                </button>
              )}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700 }} className="pkr">
              {formatPKR(summary?.balance || 0)}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Total: {formatPKR(summary?.totalIncome)}</span>
              <span>Allocated: {formatPKR(summary?.totalAllocated)}</span>
            </div>
            {summary?.isDeficit && (
              <div className="badge badge-danger" style={{ marginTop: 8 }}>In Deficit</div>
            )}
          </div>

          {/* Budget Cards grouped by category */}
          {budgets?.length === 0 ? (
            <EmptyState icon={<IoWallet />} title="No budgets yet" subtitle="Tap + to create your first budget" />
          ) : (
            categories.map((cat) => {
              const catColor = categoryColorMap[cat] || '#3AAFB9';
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', background: catColor,
                      display: 'inline-block', flexShrink: 0,
                    }} />
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: catColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {cat}
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {grouped[cat].map((b) => {
                      const globalIdx = budgets.findIndex(gb => gb._id === b._id);
                      return (
                        <BudgetCard key={b._id} budget={b} catColor={catColor}
                          onExpense={() => setExpenseModal(b._id)}
                          onAddFunds={() => setFundsModal(b._id)}
                          onDetail={() => setDetailModal(b)}
                          onDelete={() => setConfirmDelete({ type: 'budget', id: b._id, name: b.name })}
                          onMoveUp={() => handleReorder(b._id, 'up')}
                          onMoveDown={() => handleReorder(b._id, 'down')}
                          isFirst={globalIdx === 0}
                          isLast={globalIdx === budgets.length - 1}
                          locked={budgetLocked}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* FAB for new budget */}
          {!budgetLocked && (
            <button className="fab" onClick={() => setBudgetModal(true)}><IoAdd /></button>
          )}
      </div>
      <div style={{ display: activeView === 'templates' ? 'block' : 'none' }}>
        <TemplatesView categoryColorMap={categoryColorMap} categoryNames={categoryNames} onBudgetsChanged={refreshAll} />
      </div>

      {/* Modals */}
      <IncomeModal open={incomeModal} onClose={() => setIncomeModal(false)}
        isDeficit={summary?.isDeficit} onDone={refreshAll} />
      <BudgetModal open={budgetModal} onClose={() => setBudgetModal(false)} onDone={refreshAll} categories={categoryNames} />
      <ExpenseModal open={!!expenseModal} budgetId={expenseModal}
        onClose={() => setExpenseModal(null)} onDone={refreshAll} />
      <AddFundsModal open={!!fundsModal} budgetId={fundsModal}
        onClose={() => setFundsModal(null)} onDone={refreshAll} />
      <BudgetDetailModal open={!!detailModal} budget={detailModal}
        onClose={() => setDetailModal(null)} onDone={refreshAll} categories={categoryNames} categoryColorMap={categoryColorMap}
        locked={budgetLocked} />
      <IncomeListModal open={incomeListModal} incomes={incomes}
        onClose={() => setIncomeListModal(false)}
        onDelete={(id, source) => setConfirmDelete({ type: 'income', id, name: source })}
        locked={budgetLocked} />
      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmDelete?.type}?`}
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This cannot be undone.`} />
    </div>
  );
}

/* ========================= TEMPLATES VIEW ========================= */
function TemplatesView({ categoryColorMap, categoryNames, onBudgetsChanged }) {
  const { data: templates, loading, refetch: refetchTemplates } = useFetch(getBudgetTemplates);
  const [createModal, setCreateModal] = useState(false);
  const [saveFromBudgetsModal, setSaveFromBudgetsModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmUse, setConfirmUse] = useState(null);
  const [detailTemplate, setDetailTemplate] = useState(null);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteBudgetTemplate(confirmDelete._id);
      toast.success('Template deleted');
      setConfirmDelete(null);
      refetchTemplates();
    } catch (err) { toast.error(err.message); }
  };

  const handleUse = async () => {
    if (!confirmUse) return;
    try {
      const res = await useBudgetTemplate(confirmUse._id);
      const data = res.data;
      toast.success(`Template applied! ${data.budgets.length} budget(s) created${data.incomeAdded > 0 ? `, PKR ${data.incomeAdded.toLocaleString()} income added` : ''}`);
      setConfirmUse(null);
      onBudgetsChanged();
    } catch (err) { toast.error(err.message); }
  };

  if (loading && !templates) return <Spinner />;

  return (
    <>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn-outline" style={{ flex: 1, fontSize: 13 }}
          onClick={() => setCreateModal(true)}>
          <IoAdd size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> New Template
        </button>
        <button className="btn-outline" style={{ flex: 1, fontSize: 13 }}
          onClick={() => setSaveFromBudgetsModal(true)}>
          <IoDocumentText size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Save Current
        </button>
      </div>

      {!templates || templates.length === 0 ? (
        <EmptyState icon={<IoBookmark />} title="No templates yet" subtitle="Create a template or save your current budgets as a template" />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {templates.map((tpl) => {
            // Group items by category for display
            const tplGrouped = {};
            tpl.items.forEach(item => {
              const cat = item.category || 'General';
              if (!tplGrouped[cat]) tplGrouped[cat] = [];
              tplGrouped[cat].push(item);
            });
            const totalAllocation = tpl.items.reduce((sum, i) => sum + i.allocatedAmount, 0);

            return (
              <div key={tpl._id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => setDetailTemplate(tpl)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tpl.name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {tpl.items.length} budget{tpl.items.length !== 1 ? 's' : ''} &middot; Total: {formatPKR(totalAllocation)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-ghost" style={{ padding: 4, color: 'var(--success)' }}
                      onClick={(e) => { e.stopPropagation(); setConfirmUse(tpl); }}
                      title="Use Template">
                      <IoPlayCircle size={20} />
                    </button>
                    <button className="btn-ghost" style={{ padding: 4, color: 'var(--danger)' }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(tpl); }}>
                      <IoTrash size={16} />
                    </button>
                  </div>
                </div>

                {/* Category color dots */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {Object.keys(tplGrouped).sort().map(cat => {
                    const cc = categoryColorMap[cat] || '#3AAFB9';
                    return (
                      <span key={cat} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: cc + '15', color: cc,
                        border: `1px solid ${cc}30`,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cc, display: 'inline-block' }} />
                        {cat} ({tplGrouped[cat].length})
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTemplateModal open={createModal} onClose={() => setCreateModal(false)}
        onDone={refetchTemplates} categoryNames={categoryNames} />

      <SaveFromBudgetsModal open={saveFromBudgetsModal} onClose={() => setSaveFromBudgetsModal(false)}
        onDone={refetchTemplates} />

      <TemplateDetailModal open={!!detailTemplate} template={detailTemplate}
        onClose={() => setDetailTemplate(null)} categoryColorMap={categoryColorMap} />

      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete template?"
        message={`Delete template "${confirmDelete?.name}"? This won't affect existing budgets.`} />

      <ConfirmModal open={!!confirmUse} onClose={() => setConfirmUse(null)}
        onConfirm={handleUse}
        title="Use template?"
        message={`Apply "${confirmUse?.name}"? This will create ${confirmUse?.items?.length} budget(s) and add the required income to your pool.`} />
    </>
  );
}

function CreateTemplateModal({ open, onClose, onDone, categoryNames }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState([{ name: '', category: 'General', allocatedAmount: '' }]);
  const [loading, setLoading] = useState(false);

  const addItem = () => setItems([...items, { name: '', category: 'General', allocatedAmount: '' }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, key, val) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [key]: val };
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(i => i.name.trim() && Number(i.allocatedAmount) > 0);
    if (validItems.length === 0) { toast.error('Add at least one valid item'); return; }
    setLoading(true);
    try {
      await createBudgetTemplate({
        name,
        items: validItems.map(i => ({ ...i, allocatedAmount: Number(i.allocatedAmount) })),
      });
      toast.success('Template created');
      setName(''); setItems([{ name: '', category: 'General', allocatedAmount: '' }]);
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Template">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Template Name</label>
          <input type="text" placeholder="e.g., Monthly Essentials" value={name}
            onChange={(e) => setName(e.target.value)} required />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Budget Items</label>
            <button type="button" className="btn-ghost" onClick={addItem}
              style={{ color: 'var(--primary)', fontSize: 13 }}>+ Add Item</button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="text" placeholder="Budget name" value={item.name}
                  onChange={(e) => updateItem(idx, 'name', e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn-ghost" onClick={() => removeItem(idx)}
                  style={{ color: 'var(--danger)', padding: 4 }}><IoTrash size={16} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={item.category} onChange={(e) => updateItem(idx, 'category', e.target.value)}
                  style={{ flex: 1 }}>
                  {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" placeholder="Amount" value={item.allocatedAmount}
                  onChange={(e) => updateItem(idx, 'allocatedAmount', e.target.value)}
                  style={{ flex: 1 }} min="1" />
              </div>
            </div>
          ))}
        </div>

        {items.filter(i => i.name.trim() && Number(i.allocatedAmount) > 0).length > 0 && (
          <div style={{
            padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8,
            fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center',
          }}>
            Total: <strong style={{ color: 'var(--primary)' }}>
              {formatPKR(items.reduce((s, i) => s + (Number(i.allocatedAmount) || 0), 0))}
            </strong>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Template'}
        </button>
      </form>
    </Modal>
  );
}

function SaveFromBudgetsModal({ open, onClose, onDone }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTemplateFromBudgets({ name });
      toast.success('Template saved from current budgets');
      setName('');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Current Budgets as Template">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Template Name</label>
          <input type="text" placeholder="e.g., March 2026 Setup" value={name}
            onChange={(e) => setName(e.target.value)} required />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          This will save all your current budgets (names, categories, and allocations) as a reusable template.
        </p>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save as Template'}
        </button>
      </form>
    </Modal>
  );
}

function TemplateDetailModal({ open, template, onClose, categoryColorMap }) {
  if (!template) return null;

  const grouped = {};
  template.items.forEach(item => {
    const cat = item.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  const totalAllocation = template.items.reduce((sum, i) => sum + i.allocatedAmount, 0);

  return (
    <Modal open={open} onClose={onClose} title={template.name}>
      <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-muted)' }}>
        {template.items.length} items &middot; Total: <strong>{formatPKR(totalAllocation)}</strong>
      </div>

      {Object.keys(grouped).sort().map(cat => {
        const cc = categoryColorMap[cat] || '#3AAFB9';
        return (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: cc,
                display: 'inline-block',
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: cc, textTransform: 'uppercase' }}>{cat}</span>
            </div>
            {grouped[cat].map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 14 }}>{item.name}</span>
                <span className="pkr" style={{ fontSize: 14, fontWeight: 600 }}>{formatPKR(item.allocatedAmount)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </Modal>
  );
}

/* ========================= BUDGET COMPONENTS (unchanged) ========================= */

function BudgetCard({ budget, catColor, onExpense, onAddFunds, onDetail, onDelete, onMoveUp, onMoveDown, isFirst, isLast, locked }) {
  const pct = budget.allocatedAmount > 0
    ? ((budget.allocatedAmount - budget.remainingAmount) / budget.allocatedAmount) * 100 : 0;
  const isExhausted = budget.remainingAmount <= 0;

  return (
    <div className="card" onClick={onDetail} style={{
      cursor: 'pointer',
      background: catColor ? `${catColor}0D` : undefined,
      borderLeft: catColor ? `3px solid ${catColor}40` : undefined,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{budget.name}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {budget.expenseCount} expense{budget.expenseCount !== 1 ? 's' : ''} &middot; Spent {formatPKR(budget.totalSpent)}
          </p>
        </div>
        {!locked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              style={{ padding: 4, opacity: isFirst ? 0.3 : 1 }} disabled={isFirst}>
              <IoChevronUp size={16} />
            </button>
            <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              style={{ padding: 4, opacity: isLast ? 0.3 : 1 }} disabled={isLast}>
              <IoChevronDown size={16} />
            </button>
            <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ color: 'var(--danger)', padding: 4 }}>
              <IoTrash size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ margin: '12px 0 8px', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, transition: 'width 0.3s',
          width: `${Math.min(pct, 100)}%`,
          background: pct >= 100 ? 'var(--danger)' : pct >= 75 ? 'var(--warning)' : 'var(--primary)',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span className="pkr" style={{ fontWeight: 600, color: isExhausted ? 'var(--danger)' : 'var(--text)' }}>
          {formatPKR(budget.remainingAmount)} left
        </span>
        <span style={{ color: 'var(--text-muted)' }}>of {formatPKR(budget.allocatedAmount)}</span>
      </div>

      {!locked && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {!isExhausted && (
            <button className="btn-outline" style={{ flex: 1, fontSize: 13 }}
              onClick={(e) => { e.stopPropagation(); onExpense(); }}>
              <IoCash size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Log Expense
            </button>
          )}
          <button className="btn-outline" style={{ flex: 1, fontSize: 13 }}
            onClick={(e) => { e.stopPropagation(); onAddFunds(); }}>
            <IoAddCircle size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Add Funds
          </button>
        </div>
      )}
    </div>
  );
}

function IncomeModal({ open, onClose, isDeficit, onDone }) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [deficitNote, setDeficitNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addIncome({ amount: Number(amount), source, deficitNote: deficitNote || undefined });
      toast.success('Income added');
      setAmount(''); setSource(''); setDeficitNote('');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Income">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Amount (PKR)</label>
          <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" />
        </div>
        <div className="form-group">
          <label>Source / Description</label>
          <input type="text" placeholder="e.g., Salary" value={source} onChange={(e) => setSource(e.target.value)} required />
        </div>
        {isDeficit && (
          <div className="form-group">
            <label>Deficit Note (required — where is this money from?)</label>
            <textarea placeholder="Explain the source..." value={deficitNote}
              onChange={(e) => setDeficitNote(e.target.value)} required rows={2} />
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding...' : 'Add Income'}
        </button>
      </form>
    </Modal>
  );
}

function BudgetModal({ open, onClose, onDone, categories }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createBudget({ name, allocatedAmount: Number(amount), category });
      toast.success('Budget created');
      setName(''); setAmount(''); setCategory('General');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Budget">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Budget Name</label>
          <input type="text" placeholder="e.g., Groceries" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Amount (PKR)</label>
          <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Budget'}
        </button>
      </form>
    </Modal>
  );
}

function ExpenseModal({ open, budgetId, onClose, onDone }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addExpense({ budgetId, description, amount: Number(amount) });
      toast.success('Expense logged');
      setDescription(''); setAmount('');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Expense">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Description</label>
          <input type="text" placeholder="e.g., Weekly groceries" value={description}
            onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Amount (PKR)</label>
          <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logging...' : 'Log Expense'}
        </button>
      </form>
    </Modal>
  );
}

function AddFundsModal({ open, budgetId, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addFundsToBudget(budgetId, { amount: Number(amount), note });
      toast.success('Funds added');
      setAmount(''); setNote('');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Funds">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Amount (PKR)</label>
          <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" />
        </div>
        <div className="form-group">
          <label>Note (where are these funds from?)</label>
          <textarea placeholder="e.g., Extra from savings" value={note}
            onChange={(e) => setNote(e.target.value)} required rows={2} />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding...' : 'Add Funds'}
        </button>
      </form>
    </Modal>
  );
}

function BudgetDetailModal({ open, budget, onClose, onDone, categories, categoryColorMap, locked }) {
  const { settings: detailSettings } = useSettings();
  const [expenses, setExpenses] = useState([]);
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');
  const budgetSwipe = useSwipeTabs(['expenses', 'funds'], activeTab, setActiveTab, undefined, detailSettings?.tabSwipeBudget !== false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmt, setEditAmt] = useState('');
  const [confirmDeleteExp, setConfirmDeleteExp] = useState(null);
  const [confirmDeleteFund, setConfirmDeleteFund] = useState(null);
  const [fetched, setFetched] = useState(false);

  const fetchData = async () => {
    if (!budget?._id) return;
    setLoading(true);
    try {
      const [expRes, fundRes] = await Promise.all([
        getExpenses(budget._id),
        getFundEntries(budget._id),
      ]);
      setExpenses(expRes.data);
      setFunds(fundRes.data);
      setFetched(true);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  if (open && budget?._id && !fetched && !loading) {
    fetchData();
  }

  const handleClose = () => {
    setExpenses([]); setFunds([]); setFetched(false); setEditingBudget(false); setEditingExpense(null); setActiveTab('expenses');
    onClose();
  };

  const handleSaveBudget = async () => {
    try {
      await updateBudget(budget._id, { name: budgetName, category: budgetCategory });
      toast.success('Budget updated');
      setEditingBudget(false);
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveExpense = async () => {
    if (!editingExpense) return;
    try {
      await updateExpense(editingExpense._id, { description: editDesc, amount: Number(editAmt) });
      toast.success('Expense updated');
      setEditingExpense(null);
      fetchData();
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteExpense = async () => {
    if (!confirmDeleteExp) return;
    try {
      await deleteExpense(confirmDeleteExp._id);
      toast.success('Expense deleted');
      setConfirmDeleteExp(null);
      fetchData();
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteFund = async () => {
    if (!confirmDeleteFund) return;
    try {
      await deleteFundEntry(confirmDeleteFund._id);
      toast.success('Fund entry deleted');
      setConfirmDeleteFund(null);
      fetchData();
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <Modal open={open} onClose={handleClose} title={budget?.name}>
      {loading ? <Spinner /> : (
        <div onTouchStart={e => { e.stopPropagation(); budgetSwipe.onTouchStart(e); }}
          onTouchEnd={e => { e.stopPropagation(); budgetSwipe.onTouchEnd(e); }}>
          {/* Budget edit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14 }}>
              <span>Allocated: <strong>{formatPKR(budget?.allocatedAmount)}</strong></span>
              <span style={{ marginLeft: 12 }}>Remaining: <strong style={{ color: budget?.remainingAmount <= 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatPKR(budget?.remainingAmount)}</strong></span>
            </div>
            {!locked && (
              <button className="btn-ghost" style={{ padding: 4 }}
                onClick={() => { setEditingBudget(true); setBudgetName(budget?.name || ''); setBudgetCategory(budget?.category || 'General'); }}>
                <IoCreate size={16} color="var(--text-muted)" />
              </button>
            )}
          </div>

          {budget?.category && (() => {
            const cc = categoryColorMap?.[budget.category];
            return (
              <div style={{ marginBottom: 12 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: cc ? cc + '25' : 'var(--bg-input)',
                  color: cc || 'var(--text-muted)',
                  border: cc ? `1px solid ${cc}50` : undefined,
                }}>
                  {cc && <span style={{ width: 8, height: 8, borderRadius: '50%', background: cc, display: 'inline-block' }} />}
                  {budget.category}
                </span>
              </div>
            );
          })()}

          {editingBudget && (
            <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={budgetName} onChange={(e) => setBudgetName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveBudget}>Save</button>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => setEditingBudget(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Tabs for Expenses / Funds */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid var(--border)' }}>
            <button onClick={() => setActiveTab('expenses')}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none', color: activeTab === 'expenses' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'expenses' ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
              }}>
              Expenses ({expenses.length})
            </button>
            <button onClick={() => setActiveTab('funds')}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none', color: activeTab === 'funds' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'funds' ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
              }}>
              Funds ({funds.length})
            </button>
          </div>

          {/* Expense list */}
          {activeTab === 'expenses' && (
            expenses.length === 0 ? (
              <EmptyState title="No expenses yet" />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {expenses.map((exp) => (
                  <div key={exp._id}>
                    {editingExpense?._id === exp._id ? (
                      <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12 }}>
                        <div className="form-group">
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" />
                        </div>
                        <div className="form-group">
                          <input type="number" value={editAmt} onChange={(e) => setEditAmt(e.target.value)} placeholder="Amount" min="1" />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={handleSaveExpense}>Save</button>
                          <button className="btn-outline" style={{ flex: 1, fontSize: 13 }} onClick={() => setEditingExpense(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0', borderBottom: '1px solid var(--border)',
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{exp.description}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {formatDate(exp.date)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="pkr" style={{ fontWeight: 600, color: 'var(--danger)' }}>
                            -{formatPKR(exp.amount)}
                          </span>
                          {!locked && (
                            <>
                              <button className="btn-ghost" style={{ padding: 4 }}
                                onClick={() => { setEditingExpense(exp); setEditDesc(exp.description); setEditAmt(exp.amount); }}>
                                <IoCreate size={14} color="var(--text-muted)" />
                              </button>
                              <button className="btn-ghost" style={{ color: 'var(--danger)', padding: 4 }}
                                onClick={() => setConfirmDeleteExp(exp)}>
                                <IoTrash size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Funds list */}
          {activeTab === 'funds' && (
            funds.length === 0 ? (
              <EmptyState title="No funds added yet" />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {funds.map((fund) => (
                  <div key={fund._id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{fund.note}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatDate(fund.date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="pkr" style={{ fontWeight: 600, color: 'var(--success)' }}>
                        +{formatPKR(fund.amount)}
                      </span>
                      {!locked && (
                        <button className="btn-ghost" style={{ color: 'var(--danger)', padding: 4 }}
                          onClick={() => setConfirmDeleteFund(fund)}>
                          <IoTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          <ConfirmModal open={!!confirmDeleteExp} onClose={() => setConfirmDeleteExp(null)}
            onConfirm={handleDeleteExpense}
            title="Delete expense?"
            message={`Delete "${confirmDeleteExp?.description}" (${formatPKR(confirmDeleteExp?.amount)})?`} />

          <ConfirmModal open={!!confirmDeleteFund} onClose={() => setConfirmDeleteFund(null)}
            onConfirm={handleDeleteFund}
            title="Delete fund entry?"
            message={`Delete fund "${confirmDeleteFund?.note}" (${formatPKR(confirmDeleteFund?.amount)})? This will reduce the budget's allocated and remaining amounts.`} />
        </div>
      )}
    </Modal>
  );
}

function IncomeListModal({ open, incomes, onClose, onDelete, locked }) {
  return (
    <Modal open={open} onClose={onClose} title="Income History">
      {!incomes || incomes.length === 0 ? (
        <EmptyState title="No income added yet" />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {incomes.map((inc) => (
            <div key={inc._id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{inc.source}</div>
                {inc.deficitNote && (
                  <div style={{ fontSize: 11, color: 'var(--warning)' }}>Note: {inc.deficitNote}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatDate(inc.date)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pkr" style={{ fontWeight: 600, color: 'var(--success)' }}>
                  +{formatPKR(inc.amount)}
                </span>
                {!locked && (
                  <button className="btn-ghost" style={{ color: 'var(--danger)', padding: 4 }}
                    onClick={() => onDelete(inc._id, inc.source)}>
                    <IoTrash size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
