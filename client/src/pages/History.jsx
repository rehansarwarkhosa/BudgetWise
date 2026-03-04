import { useState } from 'react';
import toast from 'react-hot-toast';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { formatPKR, monthName } from '../utils/format';
import { getBudgetsByPeriod, getExpenses, triggerRollover } from '../api';
import { useSettings } from '../context/SettingsContext';

export default function History() {
  const { settings } = useSettings();
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailBudget, setDetailBudget] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expLoading, setExpLoading] = useState(false);
  const [rolloverMonth, setRolloverMonth] = useState('');
  const [rolloverYear, setRolloverYear] = useState('');

  // Generate past periods (last 12 months)
  const periods = [];
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const loadPeriod = async (period) => {
    setSelectedPeriod(period);
    setLoading(true);
    try {
      const res = await getBudgetsByPeriod(period.month, period.year);
      setBudgets(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const loadExpenses = async (budget) => {
    setDetailBudget(budget);
    setExpLoading(true);
    try {
      const res = await getExpenses(budget._id);
      setExpenses(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setExpLoading(false); }
  };

  const handleRollover = async () => {
    if (!rolloverMonth || !rolloverYear) return toast.error('Select month and year');
    try {
      const res = await triggerRollover({ month: Number(rolloverMonth), year: Number(rolloverYear) });
      toast.success(res.data.message);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="page">
      <h1 className="page-title">History</h1>

      {/* Rollover Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Month-End Rollover</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Move unspent budgets to savings for a past period.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={rolloverMonth} onChange={(e) => setRolloverMonth(e.target.value)} style={{ flex: 1 }}>
            <option value="">Month</option>
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
            ))}
          </select>
          <input type="number" placeholder="Year" value={rolloverYear}
            onChange={(e) => setRolloverYear(e.target.value)} style={{ flex: 1 }} />
        </div>
        <button className="btn-primary" onClick={handleRollover}>Run Rollover</button>
      </div>

      {/* Past Periods */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
        Past Periods
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {periods.map((p) => (
          <button key={`${p.month}-${p.year}`} className="btn-outline"
            style={{
              fontSize: 12, padding: '10px 6px',
              borderColor: selectedPeriod?.month === p.month && selectedPeriod?.year === p.year ? 'var(--primary)' : undefined,
              color: selectedPeriod?.month === p.month && selectedPeriod?.year === p.year ? 'var(--primary)' : undefined,
            }}
            onClick={() => loadPeriod(p)}>
            {monthName(p.month)} {p.year}
          </button>
        ))}
      </div>

      {/* Period Budgets */}
      {selectedPeriod && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            {monthName(selectedPeriod.month)} {selectedPeriod.year}
          </h3>
          {loading ? <Spinner /> : budgets.length === 0 ? (
            <EmptyState title="No budgets for this period" />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {budgets.map((b) => (
                <div key={b._id} className="card" style={{ cursor: 'pointer' }}
                  onClick={() => loadExpenses(b)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</h4>
                    <span className="pkr" style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatPKR(b.allocatedAmount)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Spent: {formatPKR(b.totalSpent)} &middot; Remaining: {formatPKR(b.remainingAmount)}
                    &middot; {b.expenseCount} expense{b.expenseCount !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Expense Detail Modal */}
      <Modal open={!!detailBudget} onClose={() => { setDetailBudget(null); setExpenses([]); }}
        title={detailBudget?.name}>
        {expLoading ? <Spinner /> : expenses.length === 0 ? (
          <EmptyState title="No expenses" />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {expenses.map((exp) => (
              <div key={exp._id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}>
                <span>{exp.description}</span>
                <span className="pkr" style={{ fontWeight: 600 }}>{formatPKR(exp.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
