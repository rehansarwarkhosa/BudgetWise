import { Router } from 'express';
import Income from '../models/Income.js';
import Budget from '../models/Budget.js';
import Settings from '../models/Settings.js';
import { success, error, round2 } from '../utils/response.js';
import { getCurrentPeriod } from '../utils/monthEnd.js';

const router = Router();

// Get income pool summary for current period
router.get('/summary', async (req, res, next) => {
  try {
    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();

    const incomes = await Income.find({ 'period.month': period.month, 'period.year': period.year });
    const totalIncome = round2(incomes.reduce((sum, i) => sum + i.amount, 0));

    const budgets = await Budget.find({ 'period.month': period.month, 'period.year': period.year });
    const totalAllocated = round2(budgets.reduce((sum, b) => sum + b.allocatedAmount, 0));

    const balance = round2(totalIncome - totalAllocated);
    const negativeLimit = settings?.negativeLimit || 0;
    const isDeficit = balance < 0;

    success(res, {
      totalIncome,
      totalAllocated,
      balance,
      negativeLimit,
      isDeficit,
      period,
    });
  } catch (err) { next(err); }
});

// Get all incomes for current period
router.get('/', async (req, res, next) => {
  try {
    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();
    const incomes = await Income.find({
      'period.month': period.month,
      'period.year': period.year,
    }).sort({ date: -1 });
    success(res, incomes);
  } catch (err) { next(err); }
});

// Add income
router.post('/', async (req, res, next) => {
  try {
    const { amount, source, deficitNote } = req.body;
    if (!amount || !source) return error(res, 'Amount and source are required');
    if (amount <= 0) return error(res, 'Amount must be greater than 0');

    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();

    // Check if currently in deficit
    const incomes = await Income.find({ 'period.month': period.month, 'period.year': period.year });
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const budgets = await Budget.find({ 'period.month': period.month, 'period.year': period.year });
    const totalAllocated = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
    const currentBalance = totalIncome - totalAllocated;

    if (currentBalance < 0 && !deficitNote) {
      return error(res, 'You are in deficit. Please provide a note explaining the source of this income.');
    }

    const income = await Income.create({
      amount: round2(amount),
      source,
      deficitNote: deficitNote || '',
      period,
    });

    success(res, income, 201);
  } catch (err) { next(err); }
});

// Delete income
router.delete('/:id', async (req, res, next) => {
  try {
    const income = await Income.findById(req.params.id);
    if (!income) return error(res, 'Income not found', 404);

    const period = income.period;
    const settings = await Settings.findOne();
    const negativeLimit = settings?.negativeLimit || 0;

    // Calculate what balance would be after removing this income
    const incomes = await Income.find({ 'period.month': period.month, 'period.year': period.year });
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const budgets = await Budget.find({ 'period.month': period.month, 'period.year': period.year });
    const totalAllocated = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
    const newBalance = round2((totalIncome - income.amount) - totalAllocated);

    if (newBalance < -negativeLimit) {
      return error(res, `Cannot delete this income. Balance would be PKR ${newBalance.toLocaleString()}, which exceeds the negative limit of PKR ${negativeLimit.toLocaleString()}. Delete some budgets first.`);
    }

    await Income.findByIdAndDelete(req.params.id);
    success(res, { message: 'Income deleted' });
  } catch (err) { next(err); }
});

export default router;
