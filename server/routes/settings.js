import { Router } from 'express';
import sgMail from '@sendgrid/mail';
import Settings from '../models/Settings.js';
import Income from '../models/Income.js';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import Routine from '../models/Routine.js';
import RoutineEntry from '../models/RoutineEntry.js';
import Savings from '../models/Savings.js';
import Tag from '../models/Tag.js';
import Topic from '../models/Topic.js';
import SubTopic from '../models/SubTopic.js';
import Note from '../models/Note.js';
import Trail from '../models/Trail.js';
import FundEntry from '../models/FundEntry.js';
import AuditLog from '../models/AuditLog.js';
import BudgetCategory from '../models/BudgetCategory.js';
import BudgetTemplate from '../models/BudgetTemplate.js';
import WorkOrder from '../models/WorkOrder.js';
import WorkOrderNote from '../models/WorkOrderNote.js';
import PriceItem from '../models/PriceItem.js';
import PriceEntry from '../models/PriceEntry.js';
import { success, error } from '../utils/response.js';
import { getCurrentPeriod } from '../utils/monthEnd.js';

const router = Router();

// Get or create settings
router.get('/', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      const period = getCurrentPeriod();
      settings = await Settings.create({
        mode: 'monthly',
        negativeLimit: 0,
        currentPeriod: period,
      });
    }
    success(res, settings);
  } catch (err) { next(err); }
});

// Update settings
router.put('/', async (req, res, next) => {
  try {
    const { mode, negativeLimit, currentPeriod, notificationEmail, emailNotificationsEnabled, theme, trailBoldText, trailHighlights } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      const period = getCurrentPeriod();
      settings = await Settings.create({ mode: 'monthly', negativeLimit: 0, currentPeriod: period });
    }
    const changes = [];
    if (mode !== undefined && mode !== settings.mode) { changes.push(`mode: "${settings.mode}" -> "${mode}"`); settings.mode = mode; }
    else if (mode !== undefined) settings.mode = mode;
    if (negativeLimit !== undefined && negativeLimit !== settings.negativeLimit) { changes.push(`negativeLimit: ${settings.negativeLimit} -> ${negativeLimit} PKR`); settings.negativeLimit = negativeLimit; }
    else if (negativeLimit !== undefined) settings.negativeLimit = negativeLimit;
    if (currentPeriod) { if (currentPeriod.month !== settings.currentPeriod?.month || currentPeriod.year !== settings.currentPeriod?.year) changes.push(`period: ${settings.currentPeriod?.month}/${settings.currentPeriod?.year} -> ${currentPeriod.month}/${currentPeriod.year}`); settings.currentPeriod = currentPeriod; }
    if (notificationEmail !== undefined && notificationEmail !== settings.notificationEmail) { changes.push(`email: "${settings.notificationEmail}" -> "${notificationEmail}"`); settings.notificationEmail = notificationEmail; }
    else if (notificationEmail !== undefined) settings.notificationEmail = notificationEmail;
    if (emailNotificationsEnabled !== undefined && emailNotificationsEnabled !== settings.emailNotificationsEnabled) { changes.push(`emailNotifications: ${settings.emailNotificationsEnabled} -> ${emailNotificationsEnabled}`); settings.emailNotificationsEnabled = emailNotificationsEnabled; }
    else if (emailNotificationsEnabled !== undefined) settings.emailNotificationsEnabled = emailNotificationsEnabled;
    if (theme !== undefined && theme !== settings.theme) { changes.push(`theme: "${settings.theme}" -> "${theme}"`); settings.theme = theme; }
    else if (theme !== undefined) settings.theme = theme;
    if (trailBoldText !== undefined && trailBoldText !== settings.trailBoldText) { changes.push(`trailBoldText: ${settings.trailBoldText} -> ${trailBoldText}`); settings.trailBoldText = trailBoldText; }
    else if (trailBoldText !== undefined) settings.trailBoldText = trailBoldText;
    if (trailHighlights !== undefined) { settings.trailHighlights = trailHighlights; changes.push(`trailHighlights updated (${trailHighlights.length} rules)`); }
    await settings.save();

    if (changes.length) {
      await AuditLog.create({
        action: 'UPDATE', entity: 'Settings',
        details: `Updated settings: ${changes.join(', ')}`,
      });
    }

    success(res, settings);
  } catch (err) { next(err); }
});

// Test email
router.post('/test-email', async (req, res, next) => {
  try {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      return error(res, 'SendGrid is not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL missing)');
    }
    const settings = await Settings.findOne();
    const toEmail = settings?.notificationEmail;
    if (!toEmail) return error(res, 'No notification email set in settings');

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const timeStr = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

    await sgMail.send({
      to: toEmail,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'BudgetWise — Test Email',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6C63FF; margin-bottom: 4px;">Test Email</h2>
          <p style="color: #666; font-size: 13px; margin-bottom: 16px;">${timeStr} (PKT)</p>
          <p style="line-height: 1.6;">This is a test email from BudgetWise. If you received this, your email notifications are configured correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Sent by BudgetWise</p>
        </div>
      `,
    });

    await AuditLog.create({
      action: 'NOTIFY', entity: 'Settings',
      details: `Test email sent to ${toEmail}`,
    });

    success(res, { message: 'Test email sent successfully' });
  } catch (err) {
    console.error('Test email error:', err.message);
    return error(res, 'Failed to send test email: ' + (err.message || 'Unknown error'));
  }
});

// Export all data
router.get('/export', async (req, res, next) => {
  try {
    const [settings, incomes, budgets, expenses, routines, routineEntries, savings, tags, topics, subTopics, notes, trails, fundEntries, auditLogs, budgetCategories, budgetTemplates, workOrders, workOrderNotes, priceItems, priceEntries] = await Promise.all([
      Settings.findOne(),
      Income.find(),
      Budget.find(),
      Expense.find(),
      Routine.find(),
      RoutineEntry.find(),
      Savings.find(),
      Tag.find(),
      Topic.find(),
      SubTopic.find(),
      Note.find(),
      Trail.find(),
      FundEntry.find(),
      AuditLog.find(),
      BudgetCategory.find(),
      BudgetTemplate.find(),
      WorkOrder.find(),
      WorkOrderNote.find(),
      PriceItem.find(),
      PriceEntry.find(),
    ]);
    success(res, {
      exportDate: new Date().toISOString(),
      version: 1,
      settings, incomes, budgets, expenses, routines, routineEntries, savings, tags, topics, subTopics, notes, trails, fundEntries, auditLogs, budgetCategories, budgetTemplates, workOrders, workOrderNotes, priceItems, priceEntries,
    });
  } catch (err) { next(err); }
});

// Import data (restore from backup)
router.post('/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!data || !data.version) return error(res, 'Invalid backup file');

    // Snapshot current data before clearing — if import fails we can restore
    const snapshot = {
      incomes: await Income.find().lean(),
      budgets: await Budget.find().lean(),
      expenses: await Expense.find().lean(),
      routines: await Routine.find().lean(),
      routineEntries: await RoutineEntry.find().lean(),
      savings: await Savings.find().lean(),
      tags: await Tag.find().lean(),
      topics: await Topic.find().lean(),
      subTopics: await SubTopic.find().lean(),
      notes: await Note.find().lean(),
      trails: await Trail.find().lean(),
      fundEntries: await FundEntry.find().lean(),
      auditLogs: await AuditLog.find().lean(),
      budgetCategories: await BudgetCategory.find().lean(),
      budgetTemplates: await BudgetTemplate.find().lean(),
      workOrders: await WorkOrder.find().lean(),
      workOrderNotes: await WorkOrderNote.find().lean(),
      priceItems: await PriceItem.find().lean(),
      priceEntries: await PriceEntry.find().lean(),
      settings: await Settings.findOne().lean(),
    };

    try {
      // Clear all existing data
      await Promise.all([
        Income.deleteMany({}), Budget.deleteMany({}), Expense.deleteMany({}),
        Routine.deleteMany({}), RoutineEntry.deleteMany({}), Savings.deleteMany({}),
        Tag.deleteMany({}), Topic.deleteMany({}), SubTopic.deleteMany({}), Note.deleteMany({}),
        Trail.deleteMany({}), FundEntry.deleteMany({}), AuditLog.deleteMany({}), BudgetCategory.deleteMany({}),
        BudgetTemplate.deleteMany({}), WorkOrder.deleteMany({}), WorkOrderNote.deleteMany({}),
        PriceItem.deleteMany({}), PriceEntry.deleteMany({}),
      ]);

      // Restore from import file — sequential to catch failures early
      if (data.incomes?.length) await Income.insertMany(data.incomes);
      if (data.budgets?.length) await Budget.insertMany(data.budgets);
      if (data.expenses?.length) await Expense.insertMany(data.expenses);
      if (data.routines?.length) await Routine.insertMany(data.routines);
      if (data.routineEntries?.length) await RoutineEntry.insertMany(data.routineEntries);
      if (data.savings?.length) await Savings.insertMany(data.savings);
      if (data.tags?.length) await Tag.insertMany(data.tags);
      if (data.topics?.length) await Topic.insertMany(data.topics);
      if (data.subTopics?.length) await SubTopic.insertMany(data.subTopics);
      if (data.notes?.length) await Note.insertMany(data.notes);
      if (data.trails?.length) await Trail.insertMany(data.trails);
      if (data.fundEntries?.length) await FundEntry.insertMany(data.fundEntries);
      if (data.auditLogs?.length) await AuditLog.insertMany(data.auditLogs);
      if (data.budgetCategories?.length) await BudgetCategory.insertMany(data.budgetCategories);
      if (data.budgetTemplates?.length) await BudgetTemplate.insertMany(data.budgetTemplates);
      if (data.workOrders?.length) await WorkOrder.insertMany(data.workOrders);
      if (data.workOrderNotes?.length) await WorkOrderNote.insertMany(data.workOrderNotes);
      if (data.priceItems?.length) await PriceItem.insertMany(data.priceItems);
      if (data.priceEntries?.length) await PriceEntry.insertMany(data.priceEntries);

      if (data.settings) {
        await Settings.findOneAndUpdate({}, {
          mode: data.settings.mode,
          negativeLimit: data.settings.negativeLimit,
          currentPeriod: data.settings.currentPeriod,
          notificationEmail: data.settings.notificationEmail || '',
          emailNotificationsEnabled: data.settings.emailNotificationsEnabled ?? true,
          theme: data.settings.theme || 'dark',
          trailBoldText: data.settings.trailBoldText ?? false,
          trailHighlights: data.settings.trailHighlights || [],
        }, { upsert: true });
      }

      success(res, { message: 'Data restored successfully' });
    } catch (importErr) {
      // Rollback: clear failed import data and restore snapshot
      await Promise.all([
        Income.deleteMany({}), Budget.deleteMany({}), Expense.deleteMany({}),
        Routine.deleteMany({}), RoutineEntry.deleteMany({}), Savings.deleteMany({}),
        Tag.deleteMany({}), Topic.deleteMany({}), SubTopic.deleteMany({}), Note.deleteMany({}),
        Trail.deleteMany({}), FundEntry.deleteMany({}), AuditLog.deleteMany({}), BudgetCategory.deleteMany({}),
        BudgetTemplate.deleteMany({}), WorkOrder.deleteMany({}), WorkOrderNote.deleteMany({}),
        PriceItem.deleteMany({}), PriceEntry.deleteMany({}),
      ]);
      if (snapshot.incomes.length) await Income.insertMany(snapshot.incomes);
      if (snapshot.budgets.length) await Budget.insertMany(snapshot.budgets);
      if (snapshot.expenses.length) await Expense.insertMany(snapshot.expenses);
      if (snapshot.routines.length) await Routine.insertMany(snapshot.routines);
      if (snapshot.routineEntries.length) await RoutineEntry.insertMany(snapshot.routineEntries);
      if (snapshot.savings.length) await Savings.insertMany(snapshot.savings);
      if (snapshot.tags.length) await Tag.insertMany(snapshot.tags);
      if (snapshot.topics.length) await Topic.insertMany(snapshot.topics);
      if (snapshot.subTopics.length) await SubTopic.insertMany(snapshot.subTopics);
      if (snapshot.notes.length) await Note.insertMany(snapshot.notes);
      if (snapshot.trails.length) await Trail.insertMany(snapshot.trails);
      if (snapshot.fundEntries.length) await FundEntry.insertMany(snapshot.fundEntries);
      if (snapshot.auditLogs.length) await AuditLog.insertMany(snapshot.auditLogs);
      if (snapshot.budgetCategories.length) await BudgetCategory.insertMany(snapshot.budgetCategories);
      if (snapshot.budgetTemplates.length) await BudgetTemplate.insertMany(snapshot.budgetTemplates);
      if (snapshot.workOrders.length) await WorkOrder.insertMany(snapshot.workOrders);
      if (snapshot.workOrderNotes.length) await WorkOrderNote.insertMany(snapshot.workOrderNotes);
      if (snapshot.priceItems.length) await PriceItem.insertMany(snapshot.priceItems);
      if (snapshot.priceEntries.length) await PriceEntry.insertMany(snapshot.priceEntries);
      if (snapshot.settings) {
        await Settings.findOneAndUpdate({}, snapshot.settings, { upsert: true });
      }
      return error(res, 'Import failed. Your previous data has been restored. Error: ' + importErr.message);
    }
  } catch (err) { next(err); }
});

// Delete all data
router.delete('/all-data', async (req, res, next) => {
  try {
    await Promise.all([
      Income.deleteMany({}),
      Budget.deleteMany({}),
      Expense.deleteMany({}),
      Routine.deleteMany({}),
      RoutineEntry.deleteMany({}),
      Savings.deleteMany({}),
      Tag.deleteMany({}),
      Topic.deleteMany({}),
      SubTopic.deleteMany({}),
      Note.deleteMany({}),
      Trail.deleteMany({}),
      FundEntry.deleteMany({}),
      AuditLog.deleteMany({}),
      BudgetCategory.deleteMany({}),
      BudgetTemplate.deleteMany({}),
      WorkOrder.deleteMany({}),
      WorkOrderNote.deleteMany({}),
      PriceItem.deleteMany({}),
      PriceEntry.deleteMany({}),
    ]);
    const period = getCurrentPeriod();
    const settings = await Settings.findOneAndUpdate(
      {},
      {
        mode: 'monthly', negativeLimit: 0, currentPeriod: period,
        notificationEmail: '', emailNotificationsEnabled: true,
        theme: 'dark', trailBoldText: false, trailHighlights: [],
      },
      { new: true, upsert: true }
    );
    success(res, { message: 'All data deleted', settings });
  } catch (err) { next(err); }
});

// ─── Budget Categories ───

const DEFAULT_CATEGORIES = [
  { name: 'General', color: '#6C63FF' },
  { name: 'Food', color: '#22c55e' },
  { name: 'Transport', color: '#3b82f6' },
  { name: 'Shopping', color: '#f59e0b' },
  { name: 'Bills', color: '#ef4444' },
  { name: 'Health', color: '#14b8a6' },
  { name: 'Education', color: '#8b5cf6' },
  { name: 'Entertainment', color: '#ec4899' },
  { name: 'Other', color: '#6b7280' },
];

// Get all budget categories (seed defaults if none exist)
router.get('/budget-categories', async (req, res, next) => {
  try {
    let categories = await BudgetCategory.find().sort({ name: 1 });
    if (categories.length === 0) {
      categories = await BudgetCategory.insertMany(DEFAULT_CATEGORIES);
      categories = categories.sort((a, b) => a.name.localeCompare(b.name));
    }
    success(res, categories);
  } catch (err) { next(err); }
});

// Add a budget category
router.post('/budget-categories', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return error(res, 'Category name is required');
    const existing = await BudgetCategory.findOne({ name: name.trim() });
    if (existing) return error(res, 'Category already exists');
    const category = await BudgetCategory.create({ name: name.trim(), color: color || '#6C63FF' });
    await AuditLog.create({ action: 'CREATE', entity: 'BudgetCategory', entityId: category._id, details: `Created budget category "${name.trim()}"` });
    success(res, category, 201);
  } catch (err) { next(err); }
});

// Update a budget category (color)
router.put('/budget-categories/:id', async (req, res, next) => {
  try {
    const category = await BudgetCategory.findById(req.params.id);
    if (!category) return error(res, 'Category not found', 404);
    const { color } = req.body;
    const changes = [];
    if (color !== undefined && color !== category.color) {
      changes.push(`color: "${category.color}" -> "${color}"`);
      category.color = color;
    }
    await category.save();
    if (changes.length) {
      await AuditLog.create({ action: 'UPDATE', entity: 'BudgetCategory', entityId: category._id, details: `Updated category "${category.name}": ${changes.join(', ')}` });
    }
    success(res, category);
  } catch (err) { next(err); }
});

// Delete a budget category
router.delete('/budget-categories/:id', async (req, res, next) => {
  try {
    const category = await BudgetCategory.findById(req.params.id);
    if (!category) return error(res, 'Category not found', 404);
    const budgetsUsing = await Budget.find({ category: category.name }).select('name');
    if (budgetsUsing.length > 0) {
      const names = budgetsUsing.map(b => `"${b.name}"`).join(', ');
      return error(res, `Cannot delete — used by: ${names}. Change their category first.`);
    }
    await category.deleteOne();
    await AuditLog.create({ action: 'DELETE', entity: 'BudgetCategory', entityId: category._id, details: `Deleted budget category "${category.name}"` });
    success(res, { message: 'Category deleted' });
  } catch (err) { next(err); }
});

export default router;
