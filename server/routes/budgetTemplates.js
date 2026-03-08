import { Router } from 'express';
import BudgetTemplate from '../models/BudgetTemplate.js';
import Budget from '../models/Budget.js';
import Income from '../models/Income.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { success, error, round2 } from '../utils/response.js';
import { getCurrentPeriod } from '../utils/monthEnd.js';

const router = Router();

// Get all templates
router.get('/', async (req, res, next) => {
  try {
    const templates = await BudgetTemplate.find().sort({ createdAt: -1 });
    success(res, templates);
  } catch (err) { next(err); }
});

// Create template from scratch
router.post('/', async (req, res, next) => {
  try {
    const { name, items } = req.body;
    if (!name) return error(res, 'Template name is required');
    if (!items || items.length === 0) return error(res, 'At least one budget item is required');

    const template = await BudgetTemplate.create({ name, items });
    await AuditLog.create({
      action: 'CREATE', entity: 'BudgetTemplate', entityId: template._id,
      details: `Created budget template "${name}" with ${items.length} item(s)`,
    });
    success(res, template, 201);
  } catch (err) { next(err); }
});

// Create template from current budgets
router.post('/from-budgets', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return error(res, 'Template name is required');

    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();

    const budgets = await Budget.find({
      'period.month': period.month,
      'period.year': period.year,
    }).sort({ sortOrder: 1, createdAt: -1 });

    if (budgets.length === 0) return error(res, 'No budgets exist in current period');

    const items = budgets.map(b => ({
      name: b.name,
      category: b.category || 'General',
      allocatedAmount: b.allocatedAmount,
    }));

    const template = await BudgetTemplate.create({ name, items });
    await AuditLog.create({
      action: 'CREATE', entity: 'BudgetTemplate', entityId: template._id,
      details: `Created budget template "${name}" from current budgets (${items.length} items)`,
    });
    success(res, template, 201);
  } catch (err) { next(err); }
});

// Use template — creates income + budgets for current period
router.post('/:id/use', async (req, res, next) => {
  try {
    const template = await BudgetTemplate.findById(req.params.id);
    if (!template) return error(res, 'Template not found', 404);

    const settings = await Settings.findOne();
    const period = settings?.currentPeriod || getCurrentPeriod();
    const negativeLimit = settings?.negativeLimit || 0;

    // Calculate total allocation needed
    const totalAllocation = template.items.reduce((sum, item) => sum + item.allocatedAmount, 0);

    // Check existing income and budgets
    const existingIncomes = await Income.find({ 'period.month': period.month, 'period.year': period.year });
    const totalExistingIncome = existingIncomes.reduce((sum, i) => sum + i.amount, 0);
    const existingBudgets = await Budget.find({ 'period.month': period.month, 'period.year': period.year });
    const totalExistingAllocated = existingBudgets.reduce((sum, b) => sum + b.allocatedAmount, 0);

    const currentBalance = round2(totalExistingIncome - totalExistingAllocated);

    // Add income for the template total if needed
    const incomeNeeded = round2(totalAllocation - currentBalance);
    if (incomeNeeded > 0) {
      // Check if adding this income + allocations would violate negative limit
      const newBalance = round2(currentBalance + incomeNeeded - totalAllocation);
      if (newBalance < -negativeLimit) {
        return error(res, `Would exceed negative limit. Need PKR ${totalAllocation.toLocaleString()} but only PKR ${(currentBalance + negativeLimit).toLocaleString()} available.`);
      }

      await Income.create({
        amount: round2(incomeNeeded),
        source: `Template: ${template.name}`,
        period,
      });
    }

    // Create budgets from template items
    const maxOrder = await Budget.findOne({
      'period.month': period.month, 'period.year': period.year,
    }).sort({ sortOrder: -1 }).select('sortOrder');
    let sortOrder = (maxOrder?.sortOrder ?? -1) + 1;

    const createdBudgets = [];
    for (const item of template.items) {
      const rounded = round2(item.allocatedAmount);
      const budget = await Budget.create({
        name: item.name,
        category: item.category || 'General',
        allocatedAmount: rounded,
        remainingAmount: rounded,
        period,
        sortOrder: sortOrder++,
      });
      createdBudgets.push(budget);
    }

    await AuditLog.create({
      action: 'USE_TEMPLATE', entity: 'BudgetTemplate', entityId: template._id,
      details: `Used template "${template.name}" — created ${createdBudgets.length} budget(s) with total PKR ${totalAllocation.toLocaleString()}`,
    });

    success(res, { budgets: createdBudgets, incomeAdded: incomeNeeded > 0 ? incomeNeeded : 0 });
  } catch (err) { next(err); }
});

// Update template
router.put('/:id', async (req, res, next) => {
  try {
    const { name, items } = req.body;
    const template = await BudgetTemplate.findById(req.params.id);
    if (!template) return error(res, 'Template not found', 404);
    if (name) template.name = name;
    if (items) template.items = items;
    await template.save();
    await AuditLog.create({
      action: 'UPDATE', entity: 'BudgetTemplate', entityId: template._id,
      details: `Updated budget template "${template.name}"`,
    });
    success(res, template);
  } catch (err) { next(err); }
});

// Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const template = await BudgetTemplate.findByIdAndDelete(req.params.id);
    if (!template) return error(res, 'Template not found', 404);
    await AuditLog.create({
      action: 'DELETE', entity: 'BudgetTemplate', entityId: template._id,
      details: `Deleted budget template "${template.name}"`,
    });
    success(res, { message: 'Template deleted' });
  } catch (err) { next(err); }
});

export default router;
