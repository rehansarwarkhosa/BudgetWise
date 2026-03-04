import { useState } from 'react';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoWallet, IoCash, IoAddCircle, IoCreate } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import useFetch from '../hooks/useFetch';
import { formatPKR } from '../utils/format';
import {
  getIncomeSummary, getIncomes, addIncome, deleteIncome,
  getBudgets, createBudget, updateBudget, deleteBudget, addFundsToBudget,
  getExpenses, addExpense, updateExpense, deleteExpense,
} from '../api';

const CATEGORIES = ['General', 'Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Education', 'Entertainment', 'Other'];

export default function Budget() {
  const { data: summary, loading: summaryLoading, refetch: refetchSummary } = useFetch(getIncomeSummary);
  const { data: budgets, loading: budgetsLoading, refetch: refetchBudgets } = useFetch(getBudgets);
  const { data: incomes, refetch: refetchIncomes } = useFetch(getIncomes);

  const [incomeModal, setIncomeModal] = useState(false);
  const [budgetModal, setBudgetModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(null);
  const [fundsModal, setFundsModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [incomeListModal, setIncomeListModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, id, name }

  const refreshAll = () => {
    refetchSummary();
    refetchBudgets();
    refetchIncomes();
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

  if (summaryLoading || budgetsLoading) return <Spinner />;

  // Group budgets by category
  const grouped = {};
  budgets?.forEach((b) => {
    const cat = b.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(b);
  });
  const categories = Object.keys(grouped).sort();

  return (
    <div className="page">
      <h1 className="page-title">Budget</h1>

      {/* Income Summary Bar */}
      <div className="card" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => setIncomeListModal(true)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Income Pool</span>
          <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setIncomeModal(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontSize: 13 }}>
            <IoAdd size={16} /> Add Income
          </button>
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
        categories.map((cat) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {cat}
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {grouped[cat].map((b) => (
                <BudgetCard key={b._id} budget={b}
                  onExpense={() => setExpenseModal(b._id)}
                  onAddFunds={() => setFundsModal(b._id)}
                  onDetail={() => setDetailModal(b)}
                  onDelete={() => setConfirmDelete({ type: 'budget', id: b._id, name: b.name })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* FAB */}
      <button className="fab" onClick={() => setBudgetModal(true)}><IoAdd /></button>

      {/* Modals */}
      <IncomeModal open={incomeModal} onClose={() => setIncomeModal(false)}
        isDeficit={summary?.isDeficit} onDone={refreshAll} />
      <BudgetModal open={budgetModal} onClose={() => setBudgetModal(false)} onDone={refreshAll} />
      <ExpenseModal open={!!expenseModal} budgetId={expenseModal}
        onClose={() => setExpenseModal(null)} onDone={refreshAll} />
      <AddFundsModal open={!!fundsModal} budgetId={fundsModal}
        onClose={() => setFundsModal(null)} onDone={refreshAll} />
      <BudgetDetailModal open={!!detailModal} budget={detailModal}
        onClose={() => setDetailModal(null)} onDone={refreshAll} />
      <IncomeListModal open={incomeListModal} incomes={incomes}
        onClose={() => setIncomeListModal(false)}
        onDelete={(id, source) => setConfirmDelete({ type: 'income', id, name: source })} />
      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmDelete?.type}?`}
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This cannot be undone.`} />
    </div>
  );
}

function BudgetCard({ budget, onExpense, onAddFunds, onDetail, onDelete }) {
  const pct = budget.allocatedAmount > 0
    ? ((budget.allocatedAmount - budget.remainingAmount) / budget.allocatedAmount) * 100 : 0;
  const isExhausted = budget.remainingAmount <= 0;

  return (
    <div className="card" onClick={onDetail} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{budget.name}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {budget.expenseCount} expense{budget.expenseCount !== 1 ? 's' : ''} &middot; Spent {formatPKR(budget.totalSpent)}
          </p>
        </div>
        <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ color: 'var(--danger)', padding: 4 }}>
          <IoTrash size={16} />
        </button>
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

function BudgetModal({ open, onClose, onDone }) {
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
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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

function BudgetDetailModal({ open, budget, onClose, onDone }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('');
  const [editingExpense, setEditingExpense] = useState(null); // expense obj
  const [editDesc, setEditDesc] = useState('');
  const [editAmt, setEditAmt] = useState('');
  const [confirmDeleteExp, setConfirmDeleteExp] = useState(null);

  const fetchExpenses = async () => {
    if (!budget?._id) return;
    setLoading(true);
    try {
      const res = await getExpenses(budget._id);
      setExpenses(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  if (open && budget?._id && expenses.length === 0 && !loading) {
    fetchExpenses();
  }

  const handleClose = () => {
    setExpenses([]); setEditingBudget(false); setEditingExpense(null);
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
      fetchExpenses();
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteExpense = async () => {
    if (!confirmDeleteExp) return;
    try {
      await deleteExpense(confirmDeleteExp._id);
      toast.success('Expense deleted');
      setConfirmDeleteExp(null);
      fetchExpenses();
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <Modal open={open} onClose={handleClose} title={budget?.name}>
      {loading ? <Spinner /> : (
        <>
          {/* Budget edit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14 }}>
              <span>Allocated: <strong>{formatPKR(budget?.allocatedAmount)}</strong></span>
              <span style={{ marginLeft: 12 }}>Remaining: <strong style={{ color: budget?.remainingAmount <= 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatPKR(budget?.remainingAmount)}</strong></span>
            </div>
            <button className="btn-ghost" style={{ padding: 4 }}
              onClick={() => { setEditingBudget(true); setBudgetName(budget?.name || ''); setBudgetCategory(budget?.category || 'General'); }}>
              <IoCreate size={16} color="var(--text-muted)" />
            </button>
          </div>

          {budget?.category && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                {budget.category}
              </span>
            </div>
          )}

          {editingBudget && (
            <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={budgetName} onChange={(e) => setBudgetName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveBudget}>Save</button>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => setEditingBudget(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Expense list */}
          {expenses.length === 0 ? (
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
                          {new Date(exp.date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="pkr" style={{ fontWeight: 600, color: 'var(--danger)' }}>
                          -{formatPKR(exp.amount)}
                        </span>
                        <button className="btn-ghost" style={{ padding: 4 }}
                          onClick={() => { setEditingExpense(exp); setEditDesc(exp.description); setEditAmt(exp.amount); }}>
                          <IoCreate size={14} color="var(--text-muted)" />
                        </button>
                        <button className="btn-ghost" style={{ color: 'var(--danger)', padding: 4 }}
                          onClick={() => setConfirmDeleteExp(exp)}>
                          <IoTrash size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <ConfirmModal open={!!confirmDeleteExp} onClose={() => setConfirmDeleteExp(null)}
            onConfirm={handleDeleteExpense}
            title="Delete expense?"
            message={`Delete "${confirmDeleteExp?.description}" (${formatPKR(confirmDeleteExp?.amount)})?`} />
        </>
      )}
    </Modal>
  );
}

function IncomeListModal({ open, incomes, onClose, onDelete }) {
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
                  {new Date(inc.date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pkr" style={{ fontWeight: 600, color: 'var(--success)' }}>
                  +{formatPKR(inc.amount)}
                </span>
                <button className="btn-ghost" style={{ color: 'var(--danger)', padding: 4 }}
                  onClick={() => onDelete(inc._id, inc.source)}>
                  <IoTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
