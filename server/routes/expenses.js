import { Router } from 'express';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import AuditLog from '../models/AuditLog.js';
import { success, error, round2 } from '../utils/response.js';

const router = Router();

// Get expenses for a budget
router.get('/budget/:budgetId', async (req, res, next) => {
  try {
    const expenses = await Expense.find({ budgetId: req.params.budgetId }).sort({ date: -1 });
    success(res, expenses);
  } catch (err) { next(err); }
});

// Add expense
router.post('/', async (req, res, next) => {
  try {
    const { budgetId, description, amount } = req.body;
    if (!budgetId || !description || !amount) return error(res, 'All fields are required');
    if (amount <= 0) return error(res, 'Amount must be greater than 0');

    const budget = await Budget.findById(budgetId);
    if (!budget) return error(res, 'Budget not found', 404);

    if (budget.remainingAmount <= 0) {
      return error(res, 'Budget exhausted. Add funds to continue.');
    }

    if (amount > budget.remainingAmount) {
      return error(res, `Amount exceeds remaining budget (PKR ${budget.remainingAmount.toLocaleString()})`);
    }

    const roundedAmt = round2(amount);
    const expense = await Expense.create({ budgetId, description, amount: roundedAmt });
    budget.remainingAmount = round2(budget.remainingAmount - roundedAmt);
    await budget.save();

    await AuditLog.create({
      action: 'CREATE', entity: 'Expense', entityId: expense._id,
      details: `Logged expense "${description}" of ${roundedAmt.toLocaleString()} PKR in "${budget.name}"`,
    });

    success(res, { expense, budgetRemaining: budget.remainingAmount }, 201);
  } catch (err) { next(err); }
});

// Update expense
router.put('/:id', async (req, res, next) => {
  try {
    const { description, amount } = req.body;
    const expense = await Expense.findById(req.params.id);
    if (!expense) return error(res, 'Expense not found', 404);

    const budget = await Budget.findById(expense.budgetId);
    if (!budget) return error(res, 'Budget not found', 404);

    if (amount !== undefined && amount !== expense.amount) {
      const diff = amount - expense.amount;
      if (diff > budget.remainingAmount) {
        return error(res, 'New amount exceeds remaining budget');
      }
      budget.remainingAmount = round2(budget.remainingAmount - diff);
      await budget.save();
      expense.amount = amount;
    }

    const changes = [];
    if (description && description !== expense.description) { changes.push(`description: "${expense.description}" -> "${description}"`); }
    if (amount !== undefined && amount !== expense.amount) { changes.push(`amount: ${expense.amount.toLocaleString()} -> ${amount.toLocaleString()} PKR`); }
    if (description) expense.description = description;
    await expense.save();

    if (changes.length) {
      await AuditLog.create({
        action: 'UPDATE', entity: 'Expense', entityId: expense._id,
        details: `Updated expense in "${budget.name}": ${changes.join(', ')}`,
      });
    }

    success(res, expense);
  } catch (err) { next(err); }
});

// Delete expense
router.delete('/:id', async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return error(res, 'Expense not found', 404);

    const budget = await Budget.findById(expense.budgetId);
    if (budget) {
      budget.remainingAmount = round2(budget.remainingAmount + expense.amount);
      await budget.save();
    }

    await Expense.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'DELETE', entity: 'Expense', entityId: expense._id,
      details: `Deleted expense "${expense.description}" of ${expense.amount.toLocaleString()} PKR from "${budget?.name || 'unknown'}"`,
    });

    success(res, { message: 'Expense deleted' });
  } catch (err) { next(err); }
});

export default router;
