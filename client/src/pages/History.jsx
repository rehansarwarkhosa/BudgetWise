import { useState } from 'react';
import toast from 'react-hot-toast';
import useBackClose from '../hooks/useBackClose';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { formatPKR, monthName } from '../utils/format';
import { getBudgetsByPeriod, getExpenses, triggerRollover, getBudgetExportData } from '../api';

const FULL_MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtPKR(amount) {
  return `PKR ${Number(amount || 0).toLocaleString('en-PK')}`;
}

function fmtDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'Asia/Karachi',
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(date) {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function History() {
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailBudget, setDetailBudget] = useState(null);
  useBackClose(!!detailBudget, () => setDetailBudget(null));
  const [expenses, setExpenses] = useState([]);
  const [expLoading, setExpLoading] = useState(false);
  const [rolloverMonth, setRolloverMonth] = useState('');
  const [rolloverYear, setRolloverYear] = useState('');

  // Export state
  const [exportMonth, setExportMonth] = useState('');
  const [exportYear, setExportYear] = useState('');
  const [exporting, setExporting] = useState(false);

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

  const handleExportPDF = async () => {
    if (!exportMonth || !exportYear) return toast.error('Select month and year');
    setExporting(true);
    try {
      const res = await getBudgetExportData(Number(exportMonth), Number(exportYear));
      const data = res.data;

      if (!data.budgets || data.budgets.length === 0) {
        toast.error('No budget data found for this period');
        setExporting(false);
        return;
      }

      generatePDF(data);
      toast.success('PDF downloaded');
    } catch (err) { toast.error(err.message); }
    finally { setExporting(false); }
  };

  const generatePDF = (data) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const periodLabel = `${FULL_MONTH_NAMES[data.period.month]} ${data.period.year}`;

    // Colors
    const primary = [26, 83, 92];     // teal dark
    const accent = [58, 175, 185];    // teal accent
    const darkText = [30, 30, 30];
    const mutedText = [100, 100, 100];
    const lightBg = [245, 248, 250];
    const white = [255, 255, 255];
    const successGreen = [34, 197, 94];
    const dangerRed = [239, 68, 68];

    // ── Helper Functions ──
    const addPage = () => {
      doc.addPage();
      y = margin;
      addFooter();
    };

    const checkSpace = (needed) => {
      if (y + needed > pageHeight - 20) {
        addPage();
      }
    };

    const addFooter = () => {
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...mutedText);
        doc.text(`BudgetWise Report  |  ${periodLabel}  |  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        // Bottom line
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      }
    };

    const drawSectionTitle = (title) => {
      checkSpace(12);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primary);
      doc.text(title, margin, y);
      y += 1;
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.6);
      doc.line(margin, y, margin + doc.getTextWidth(title) + 4, y);
      y += 6;
    };

    // ── HEADER ──
    // Header background
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Accent stripe
    doc.setFillColor(...accent);
    doc.rect(0, 38, pageWidth, 2, 'F');

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('Budget Report', margin, 18);

    // Period
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 230, 235);
    doc.text(periodLabel, margin, 28);

    // Generated date
    doc.setFontSize(8);
    doc.setTextColor(160, 200, 210);
    const genDate = fmtDateTime(new Date());
    doc.text(`Generated: ${genDate}`, pageWidth - margin, 28, { align: 'right' });

    // BudgetWise branding
    doc.setFontSize(9);
    doc.setTextColor(...white);
    doc.text('BudgetWise', pageWidth - margin, 18, { align: 'right' });

    y = 48;

    // ── EXECUTIVE SUMMARY ──
    drawSectionTitle('Executive Summary');

    // Summary cards
    const cardWidth = (contentWidth - 6) / 3;
    const cardHeight = 22;
    const summaryItems = [
      { label: 'Total Income', value: fmtPKR(data.totalIncome), color: successGreen },
      { label: 'Total Allocated', value: fmtPKR(data.totalAllocated), color: accent },
      { label: 'Unallocated Balance', value: fmtPKR(data.balance), color: data.balance >= 0 ? successGreen : dangerRed },
    ];

    summaryItems.forEach((item, idx) => {
      const x = margin + idx * (cardWidth + 3);
      // Card background
      doc.setFillColor(...lightBg);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'F');
      // Left accent border
      doc.setFillColor(...item.color);
      doc.rect(x, y + 2, 1.5, cardHeight - 4, 'F');
      // Label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedText);
      doc.text(item.label, x + 5, y + 8);
      // Value
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(item.value, x + 5, y + 16);
    });

    y += cardHeight + 4;

    // Budget count & total spent
    const totalSpent = data.budgets.reduce((sum, b) => sum + b.totalSpent, 0);
    const totalExpenses = data.budgets.reduce((sum, b) => sum + b.expenses.length, 0);
    const totalFundEntries = data.budgets.reduce((sum, b) => sum + b.fundEntries.length, 0);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(`${data.budgets.length} budgets  |  ${totalExpenses} expenses  |  ${totalFundEntries} fund additions  |  Total spent: ${fmtPKR(totalSpent)}`, margin, y + 3);
    y += 10;

    // ── INCOME BREAKDOWN ──
    drawSectionTitle('Income Sources');

    if (data.incomes.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...mutedText);
      doc.text('No income recorded for this period.', margin, y);
      y += 8;
    } else {
      const incomeRows = data.incomes.map((inc, idx) => [
        idx + 1,
        inc.source,
        fmtPKR(inc.amount),
        fmtDate(inc.date),
        inc.deficitNote || '-',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['#', 'Source', 'Amount', 'Date', 'Note']],
        body: incomeRows,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 9,
          cellPadding: 3,
          textColor: darkText,
          lineColor: [220, 220, 220],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: primary,
          textColor: white,
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: { fillColor: [250, 252, 254] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 28 },
        },
      });

      y = doc.lastAutoTable.finalY + 4;

      // Income total row
      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primary);
      doc.text('Total Income', margin + 4, y + 6);
      doc.text(fmtPKR(data.totalIncome), pageWidth - margin - 4, y + 6, { align: 'right' });
      y += 14;
    }

    // ── BUDGET ALLOCATION OVERVIEW ──
    checkSpace(30);
    drawSectionTitle('Budget Allocation Overview');

    const overviewRows = data.budgets.map((b, idx) => {
      const spent = b.totalSpent;
      const utilPct = b.allocatedAmount > 0 ? Math.round((spent / b.allocatedAmount) * 100) : 0;
      return [
        idx + 1,
        b.name,
        b.category || 'General',
        fmtPKR(b.allocatedAmount),
        fmtPKR(spent),
        fmtPKR(b.remainingAmount),
        `${utilPct}%`,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['#', 'Budget Name', 'Category', 'Allocated', 'Spent', 'Remaining', 'Used']],
      body: overviewRows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: darkText,
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: primary,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [250, 252, 254] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (hookData) => {
        // Color the "Used" column based on percentage
        if (hookData.section === 'body' && hookData.column.index === 6) {
          const pct = parseInt(hookData.cell.raw);
          if (pct >= 90) {
            hookData.cell.styles.textColor = dangerRed;
          } else if (pct >= 70) {
            hookData.cell.styles.textColor = [245, 158, 11];
          } else {
            hookData.cell.styles.textColor = successGreen;
          }
        }
      },
    });

    y = doc.lastAutoTable.finalY + 4;

    // Totals row for overview
    doc.setFillColor(...lightBg);
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primary);
    doc.text('Totals', margin + 4, y + 6);
    const overallUtil = data.totalAllocated > 0 ? Math.round((totalSpent / data.totalAllocated) * 100) : 0;
    doc.text(`Allocated: ${fmtPKR(data.totalAllocated)}   |   Spent: ${fmtPKR(totalSpent)}   |   Remaining: ${fmtPKR(data.totalAllocated - totalSpent)}   |   ${overallUtil}% used`, margin + 24, y + 6);
    y += 14;

    // ── DETAILED BUDGET BREAKDOWN ──
    data.budgets.forEach((budget, bIdx) => {
      checkSpace(35);
      // Budget header
      doc.setFillColor(...accent);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...white);
      doc.text(`${bIdx + 1}. ${budget.name}`, margin + 4, y + 7);

      const catLabel = budget.category || 'General';
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(catLabel, pageWidth - margin - 4, y + 7, { align: 'right' });
      y += 14;

      // Budget stats
      const spent = budget.totalSpent;
      const utilPct = budget.allocatedAmount > 0 ? Math.round((spent / budget.allocatedAmount) * 100) : 0;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkText);

      const statsLine = `Allocated: ${fmtPKR(budget.allocatedAmount)}   |   Spent: ${fmtPKR(spent)}   |   Remaining: ${fmtPKR(budget.remainingAmount)}   |   Utilization: ${utilPct}%`;
      doc.text(statsLine, margin, y);
      y += 7;

      // Fund Entries
      if (budget.fundEntries.length > 0) {
        checkSpace(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primary);
        doc.text('Additional Funds', margin + 2, y);
        y += 5;

        const fundRows = budget.fundEntries.map((f, idx) => [
          idx + 1,
          f.note || '-',
          fmtPKR(f.amount),
          fmtDate(f.date),
        ]);

        autoTable(doc, {
          startY: y,
          head: [['#', 'Note', 'Amount', 'Date']],
          body: fundRows,
          margin: { left: margin + 2, right: margin },
          styles: {
            fontSize: 8,
            cellPadding: 2.5,
            textColor: darkText,
            lineColor: [230, 230, 230],
            lineWidth: 0.15,
          },
          headStyles: {
            fillColor: [220, 240, 242],
            textColor: primary,
            fontStyle: 'bold',
            fontSize: 8,
          },
          alternateRowStyles: { fillColor: [252, 254, 254] },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            2: { halign: 'right', fontStyle: 'bold', textColor: successGreen },
            3: { cellWidth: 26 },
          },
        });

        y = doc.lastAutoTable.finalY + 3;

        const totalFunds = budget.fundEntries.reduce((s, f) => s + f.amount, 0);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...mutedText);
        doc.text(`Total Additional Funds: ${fmtPKR(totalFunds)}`, margin + 2, y);
        y += 6;
      }

      // Expenses
      if (budget.expenses.length > 0) {
        checkSpace(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primary);
        doc.text('Expenses', margin + 2, y);
        y += 5;

        const expRows = budget.expenses.map((e, idx) => [
          idx + 1,
          e.description,
          fmtPKR(e.amount),
          fmtDate(e.date),
        ]);

        autoTable(doc, {
          startY: y,
          head: [['#', 'Description', 'Amount', 'Date']],
          body: expRows,
          margin: { left: margin + 2, right: margin },
          styles: {
            fontSize: 8,
            cellPadding: 2.5,
            textColor: darkText,
            lineColor: [230, 230, 230],
            lineWidth: 0.15,
          },
          headStyles: {
            fillColor: [255, 240, 240],
            textColor: dangerRed,
            fontStyle: 'bold',
            fontSize: 8,
          },
          alternateRowStyles: { fillColor: [254, 252, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            2: { halign: 'right', fontStyle: 'bold' },
            3: { cellWidth: 26 },
          },
        });

        y = doc.lastAutoTable.finalY + 3;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...mutedText);
        doc.text(`Total Expenses: ${fmtPKR(spent)}  (${budget.expenses.length} transaction${budget.expenses.length !== 1 ? 's' : ''})`, margin + 2, y);
        y += 6;
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...mutedText);
        doc.text('No expenses recorded.', margin + 2, y);
        y += 6;
      }

      // Separator between budgets
      if (bIdx < data.budgets.length - 1) {
        checkSpace(8);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(margin, y, pageWidth - margin, y);
        doc.setLineDashPattern([], 0);
        y += 6;
      }
    });

    // ── FINAL SUMMARY ──
    checkSpace(30);
    y += 4;
    drawSectionTitle('Period Summary');

    const summaryData = [
      ['Total Income', fmtPKR(data.totalIncome)],
      ['Total Allocated to Budgets', fmtPKR(data.totalAllocated)],
      ['Unallocated Balance', fmtPKR(data.balance)],
      ['Total Amount Spent', fmtPKR(totalSpent)],
      ['Total Remaining in Budgets', fmtPKR(data.totalAllocated - totalSpent)],
      ['Number of Budgets', String(data.budgets.length)],
      ['Number of Income Sources', String(data.incomes.length)],
      ['Total Expense Transactions', String(totalExpenses)],
      ['Total Fund Additions', String(totalFundEntries)],
      ['Overall Budget Utilization', `${data.totalAllocated > 0 ? Math.round((totalSpent / data.totalAllocated) * 100) : 0}%`],
    ];

    autoTable(doc, {
      startY: y,
      body: summaryData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9.5,
        cellPadding: 4,
        textColor: darkText,
        lineColor: [230, 230, 230],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: primary, cellWidth: 80 },
        1: { halign: 'right', fontStyle: 'bold' },
      },
      theme: 'plain',
    });

    // Add footers to all pages
    addFooter();

    // Download
    const filename = `BudgetWise-Report-${FULL_MONTH_NAMES[data.period.month]}-${data.period.year}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="page">
      <h1 className="page-title">History</h1>

      {/* Export PDF Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Export Budget Report</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Generate a detailed PDF report of income, budget allocations, expenses, and fund additions for any month.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} style={{ flex: 1 }}>
            <option value="">Month</option>
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
            ))}
          </select>
          <input type="number" placeholder="Year" value={exportYear}
            onChange={(e) => setExportYear(e.target.value)} style={{ flex: 1 }} />
        </div>
        <button className="btn-primary" onClick={handleExportPDF} disabled={exporting}>
          {exporting ? 'Generating...' : 'Export PDF'}
        </button>
      </div>

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
      <div className="history-periods-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
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
            <div className="desktop-grid-2" style={{ display: 'grid', gap: 8 }}>
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
