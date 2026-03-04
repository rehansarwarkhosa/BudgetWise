import { Router } from 'express';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import Income from '../models/Income.js';
import Settings from '../models/Settings.js';
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
    }).sort({ createdAt: -1 });

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
    const budgets = await Budget.find({ 'period.month': month, 'period.year': year }).sort({ createdAt: -1 });

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
    const budget = await Budget.create({
      name,
      category: category || 'General',
      allocatedAmount: rounded,
      remainingAmount: rounded,
      period,
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
    if (name) budget.name = name;
    if (category !== undefined) budget.category = category;
    await budget.save();
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

    success(res, budget);
  } catch (err) { next(err); }
});

// Delete budget (and its expenses)
router.delete('/:id', async (req, res, next) => {
  try {
    const budget = await Budget.findByIdAndDelete(req.params.id);
    if (!budget) return error(res, 'Budget not found', 404);
    await Expense.deleteMany({ budgetId: budget._id });
    success(res, { message: 'Budget and expenses deleted' });
  } catch (err) { next(err); }
});

export default router;
