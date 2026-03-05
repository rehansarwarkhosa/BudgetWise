import { Router } from 'express';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import FundEntry from '../models/FundEntry.js';
import Income from '../models/Income.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { success, error, round2 } from '../utils/response.js';
import { getCurrentPeriod } from '../utils/monthEnd.js';

const router = Router();

const getPoolBalance = async (period) => {
  const incomes = await Income.find({ 'period.month': period.month, 'period.year': period.year });
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const budgets = await Budget.find({ 'period.month': period.month, 'period.year': period.year });
  const totalAllocated = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
  return round2(totalIncome - totalAllocated);
};

// Get all budgets for current period with expense stats
router.get('/', async (req, res, next) => {
  try {
    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();
    const budgets = await Budget.find({
      'period.month': period.month,
      'period.year': period.year,
    }).sort({ sortOrder: 1, createdAt: -1 });

    const budgetIds = budgets.map(b => b._id);
    const expenseStats = await Expense.aggregate([
      { $match: { budgetId: { $in: budgetIds } } },
      { $group: { _id: '$budgetId', expenseCount: { $sum: 1 }, totalSpent: { $sum: '$amount' } } },
    ]);
    const statsMap = Object.fromEntries(expenseStats.map(s => [s._id.toString(), s]));

    const budgetsWithStats = budgets.map(b => ({
      ...b.toObject(),
      expenseCount: statsMap[b._id.toString()]?.expenseCount || 0,
      totalSpent: statsMap[b._id.toString()]?.totalSpent || 0,
    }));

    success(res, budgetsWithStats);
  } catch (err) { next(err); }
});

// Get budgets for a specific period (for history)
router.get('/period/:month/:year', async (req, res, next) => {
  try {
    const month = parseInt(req.params.month);
    const year = parseInt(req.params.year);
    const budgets = await Budget.find({ 'period.month': month, 'period.year': year }).sort({ sortOrder: 1, createdAt: -1 });

    const budgetIds = budgets.map(b => b._id);
    const expenseStats = await Expense.aggregate([
      { $match: { budgetId: { $in: budgetIds } } },
      { $group: { _id: '$budgetId', expenseCount: { $sum: 1 }, totalSpent: { $sum: '$amount' } } },
    ]);
    const statsMap = Object.fromEntries(expenseStats.map(s => [s._id.toString(), s]));

    const budgetsWithStats = budgets.map(b => ({
      ...b.toObject(),
      expenseCount: statsMap[b._id.toString()]?.expenseCount || 0,
      totalSpent: statsMap[b._id.toString()]?.totalSpent || 0,
    }));

    success(res, budgetsWithStats);
  } catch (err) { next(err); }
});

// Create budget
router.post('/', async (req, res, next) => {
  try {
    const { name, allocatedAmount, category } = req.body;
    if (!name || !allocatedAmount) return error(res, 'Name and amount are required');
    if (allocatedAmount <= 0) return error(res, 'Amount must be greater than 0');

    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();
    const negativeLimit = settings?.negativeLimit || 0;

    const balance = await getPoolBalance(period);
    const newBalance = round2(balance - allocatedAmount);

    if (newBalance < -negativeLimit) {
      return error(res, `Insufficient funds. Balance: PKR ${balance.toLocaleString()}, Negative limit: PKR ${negativeLimit.toLocaleString()}`);
    }

    const rounded = round2(allocatedAmount);
    const maxOrder = await Budget.findOne({ 'period.month': period.month, 'period.year': period.year }).sort({ sortOrder: -1 }).select('sortOrder');
    const sortOrder = (maxOrder?.sortOrder ?? -1) + 1;

    const budget = await Budget.create({
      name,
      category: category || 'General',
      allocatedAmount: rounded,
      remainingAmount: rounded,
      period,
      sortOrder,
    });

    await AuditLog.create({
      action: 'CREATE', entity: 'Budget', entityId: budget._id,
      details: `Created budget "${name}" with ${rounded.toLocaleString()} PKR`,
    });

    success(res, budget, 201);
  } catch (err) { next(err); }
});

// Update budget
router.put('/:id', async (req, res, next) => {
  try {
    const { name, category } = req.body;
    const budget = await Budget.findById(req.params.id);
    if (!budget) return error(res, 'Budget not found', 404);
    const changes = [];
    if (name && name !== budget.name) { changes.push(`name: "${budget.name}" -> "${name}"`); budget.name = name; }
    if (category !== undefined && category !== budget.category) { changes.push(`category: "${budget.category}" -> "${category}"`); budget.category = category; }
    await budget.save();

    if (changes.length) {
      await AuditLog.create({
        action: 'UPDATE', entity: 'Budget', entityId: budget._id,
        details: `Updated budget "${budget.name}": ${changes.join(', ')}`,
      });
    }

    success(res, budget);
  } catch (err) { next(err); }
});

// Add funds to budget
router.post('/:id/add-funds', async (req, res, next) => {
  try {
    const { amount, note } = req.body;
    if (!amount || !note) return error(res, 'Amount and note are required');
    if (amount <= 0) return error(res, 'Amount must be greater than 0');

    const budget = await Budget.findById(req.params.id);
    if (!budget) return error(res, 'Budget not found', 404);

    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();
    const negativeLimit = settings?.negativeLimit || 0;

    const balance = await getPoolBalance(period);
    const newBalance = balance - amount;

    if (newBalance < -negativeLimit) {
      return error(res, `Insufficient funds. Balance: PKR ${balance.toLocaleString()}, Negative limit: PKR ${negativeLimit.toLocaleString()}`);
    }

    budget.allocatedAmount = round2(budget.allocatedAmount + amount);
    budget.remainingAmount = round2(budget.remainingAmount + amount);
    await budget.save();

    await FundEntry.create({ budgetId: budget._id, amount: round2(amount), note });

    await AuditLog.create({
      action: 'ADD_FUNDS', entity: 'Budget', entityId: budget._id,
      details: `Added ${amount.toLocaleString()} PKR to "${budget.name}" (Note: ${note})`,
    });

    success(res, budget);
  } catch (err) { next(err); }
});

// Get fund entries for a budget
router.get('/:id/funds', async (req, res, next) => {
  try {
    const funds = await FundEntry.find({ budgetId: req.params.id }).sort({ date: -1 });
    success(res, funds);
  } catch (err) { next(err); }
});

// Delete a fund entry
router.delete('/funds/:id', async (req, res, next) => {
  try {
    const fund = await FundEntry.findById(req.params.id);
    if (!fund) return error(res, 'Fund entry not found', 404);

    const budget = await Budget.findById(fund.budgetId);
    if (budget) {
      budget.allocatedAmount = round2(budget.allocatedAmount - fund.amount);
      budget.remainingAmount = round2(budget.remainingAmount - fund.amount);
      await budget.save();
    }

    await FundEntry.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'DELETE', entity: 'FundEntry', entityId: fund._id,
      details: `Deleted fund entry of ${fund.amount.toLocaleString()} PKR from "${budget?.name || 'unknown'}" (Note: ${fund.note})`,
    });

    success(res, { message: 'Fund entry deleted' });
  } catch (err) { next(err); }
});

// Reorder budget (move up or down)
router.put('/:id/reorder', async (req, res, next) => {
  try {
    const { direction } = req.body;
    if (!['up', 'down'].includes(direction)) return error(res, 'Direction must be "up" or "down"');

    const budget = await Budget.findById(req.params.id);
    if (!budget) return error(res, 'Budget not found', 404);

    const period = budget.period;
    const allBudgets = await Budget.find({
      'period.month': period.month,
      'period.year': period.year,
    }).sort({ sortOrder: 1, createdAt: -1 });

    const idx = allBudgets.findIndex(b => b._id.toString() === budget._id.toString());
    if (idx === -1) return error(res, 'Budget not found in list');

    if (direction === 'up' && idx === 0) return error(res, 'Already at the top');
    if (direction === 'down' && idx === allBudgets.length - 1) return error(res, 'Already at the bottom');

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const other = allBudgets[swapIdx];

    const tempOrder = budget.sortOrder;
    budget.sortOrder = other.sortOrder;
    other.sortOrder = tempOrder;

    // If they had the same sortOrder, assign distinct values
    if (budget.sortOrder === other.sortOrder) {
      budget.sortOrder = swapIdx;
      other.sortOrder = idx;
    }

    await budget.save();
    await other.save();

    success(res, { message: 'Reordered' });
  } catch (err) { next(err); }
});

// Delete budget (and its expenses and fund entries)
router.delete('/:id', async (req, res, next) => {
  try {
    const budget = await Budget.findByIdAndDelete(req.params.id);
    if (!budget) return error(res, 'Budget not found', 404);
    await Expense.deleteMany({ budgetId: budget._id });
    await FundEntry.deleteMany({ budgetId: budget._id });

    await AuditLog.create({
      action: 'DELETE', entity: 'Budget', entityId: budget._id,
      details: `Deleted budget "${budget.name}" (Allocated: ${budget.allocatedAmount.toLocaleString()} PKR)`,
    });

    success(res, { message: 'Budget and expenses deleted' });
  } catch (err) { next(err); }
});

export default router;
