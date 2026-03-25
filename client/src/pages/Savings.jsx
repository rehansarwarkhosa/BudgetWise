import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import useFetch from '../hooks/useFetch';
import { formatPKR, monthName } from '../utils/format';
import { getSavings } from '../api';

export default function Savings() {
  const { data, loading } = useFetch(getSavings);

  if (loading && !data) return <Spinner />;

  const grouped = data?.grouped || {};
  const years = Object.keys(grouped).sort((a, b) => b - a);

  return (
    <div className="page">
      <h1 className="page-title">Savings</h1>

      {years.length === 0 ? (
        <EmptyState icon="💰" title="No savings yet" subtitle="Unspent budget amounts will appear here after month-end rollover" />
      ) : (
        years.map((year) => {
          const months = Object.keys(grouped[year]).sort((a, b) => b - a);
          const yearTotal = months.reduce((sum, m) =>
            sum + grouped[year][m].reduce((s, e) => s + e.amount, 0), 0);

          return (
            <div key={year} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{year}</h2>
                <span className="pkr" style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>
                  {formatPKR(yearTotal)}
                </span>
              </div>

              <div className="desktop-grid-2">
              {months.map((month) => {
                const entries = grouped[year][month];
                const monthTotal = entries.reduce((sum, e) => sum + e.amount, 0);

                return (
                  <div key={month} className="card" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>{monthName(Number(month))} {year}</h3>
                      <span className="pkr" style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>
                        {formatPKR(monthTotal)}
                      </span>
                    </div>
                    {entries.map((entry) => (
                      <div key={entry._id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '6px 0', fontSize: 13,
                      }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {entry.budgetName}
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {' '}(of {formatPKR(entry.originalAllocation)})
                          </span>
                        </span>
                        <span className="pkr" style={{ fontWeight: 600 }}>{formatPKR(entry.amount)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
