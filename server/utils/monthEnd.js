import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import Income from '../models/Income.js';
import Savings from '../models/Savings.js';
import Settings from '../models/Settings.js';
import { round2 } from './response.js';

export const getCurrentPeriod = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

export const rolloverPeriod = async (fromMonth, fromYear) => {
  const budgets = await Budget.find({ 'period.month': fromMonth, 'period.year': fromYear });
  const incomes = await Income.find({ 'period.month': fromMonth, 'period.year': fromYear });

  const totalIncome = round2(incomes.reduce((sum, i) => sum + i.amount, 0));
  const totalAllocated = round2(budgets.reduce((sum, b) => sum + b.allocatedAmount, 0));

  const savingsEntries = [];

  // Budget-level savings: unspent amounts within each budget
  for (const budget of budgets) {
    if (budget.remainingAmount > 0) {
      savingsEntries.push({
        month: fromMonth,
        year: fromYear,
        amount: budget.remainingAmount,
        budgetName: budget.name,
        originalAllocation: budget.allocatedAmount,
      });
    }
  }

  // Unallocated income: income that was never assigned to any budget
  const unallocated = round2(totalIncome - totalAllocated);
  if (unallocated > 0) {
    savingsEntries.push({
      month: fromMonth,
      year: fromYear,
      amount: unallocated,
      budgetName: 'Unallocated Income',
      originalAllocation: totalIncome,
    });
  }

  if (savingsEntries.length > 0) {
    await Savings.insertMany(savingsEntries);
  }

  return savingsEntries;
};
