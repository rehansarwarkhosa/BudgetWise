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
import TrailNote from '../models/TrailNote.js';
import FundEntry from '../models/FundEntry.js';
import AuditLog from '../models/AuditLog.js';
import BudgetCategory from '../models/BudgetCategory.js';
import BudgetTemplate from '../models/BudgetTemplate.js';
import WorkOrder from '../models/WorkOrder.js';
import WorkOrderNote from '../models/WorkOrderNote.js';
import PriceItem from '../models/PriceItem.js';
import PriceEntry from '../models/PriceEntry.js';
import RoutineNote from '../models/RoutineNote.js';
import StockItem from '../models/StockItem.js';
import StockNote from '../models/StockNote.js';
import Reminder from '../models/Reminder.js';
import ReminderNote from '../models/ReminderNote.js';
import Event from '../models/Event.js';
import EventContainer from '../models/EventContainer.js';
import EventEntry from '../models/EventEntry.js';
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
    const { mode, negativeLimit, currentPeriod, notificationEmail, emailNotificationsEnabled, theme, trailBoldText, trailShowDate, trailHighlights, routineHighlights, kanbanDueDateColors, menuSwipeEnabled, tabSwipeTrail, tabSwipeBudget, tabSwipeRoutines, tabSwipeNotes, trailReorderEnabled, trailReorderTaps, trailDetailEnabled, trailDetailTaps, budgetLocked, settingsLocked } = req.body;
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
    if (trailShowDate !== undefined && trailShowDate !== settings.trailShowDate) { changes.push(`trailShowDate: ${settings.trailShowDate} -> ${trailShowDate}`); settings.trailShowDate = trailShowDate; }
    else if (trailShowDate !== undefined) settings.trailShowDate = trailShowDate;
    if (trailHighlights !== undefined) { settings.trailHighlights = trailHighlights; changes.push(`trailHighlights updated (${trailHighlights.length} rules)`); }
    if (routineHighlights !== undefined) { settings.routineHighlights = routineHighlights; changes.push(`routineHighlights updated (${routineHighlights.length} rules)`); }
    if (kanbanDueDateColors !== undefined) { settings.kanbanDueDateColors = kanbanDueDateColors; changes.push('kanbanDueDateColors updated'); }
    if (menuSwipeEnabled !== undefined && menuSwipeEnabled !== settings.menuSwipeEnabled) { changes.push(`menuSwipeEnabled: ${settings.menuSwipeEnabled} -> ${menuSwipeEnabled}`); settings.menuSwipeEnabled = menuSwipeEnabled; }
    else if (menuSwipeEnabled !== undefined) settings.menuSwipeEnabled = menuSwipeEnabled;
    for (const [key, label] of [['tabSwipeTrail', 'Trail'], ['tabSwipeBudget', 'Budget'], ['tabSwipeRoutines', 'Routines'], ['tabSwipeNotes', 'Notes']]) {
      const val = req.body[key];
      if (val !== undefined && val !== settings[key]) { changes.push(`${key}: ${settings[key]} -> ${val}`); settings[key] = val; }
      else if (val !== undefined) settings[key] = val;
    }
    for (const [key, label] of [['trailReorderEnabled', 'Trail Reorder'], ['trailDetailEnabled', 'Trail Detail Popup']]) {
      const val = req.body[key];
      if (val !== undefined && val !== settings[key]) { changes.push(`${key}: ${settings[key]} -> ${val}`); settings[key] = val; }
      else if (val !== undefined) settings[key] = val;
    }
    for (const [key, label] of [['trailReorderTaps', 'Reorder Taps'], ['trailDetailTaps', 'Detail Taps']]) {
      const val = req.body[key];
      if (val !== undefined && val !== settings[key]) { changes.push(`${key}: ${settings[key]} -> ${val}`); settings[key] = val; }
      else if (val !== undefined) settings[key] = val;
    }
    for (const key of ['budgetLocked', 'settingsLocked']) {
      const val = req.body[key];
      if (val !== undefined && val !== settings[key]) { changes.push(`${key}: ${settings[key]} -> ${val}`); settings[key] = val; }
      else if (val !== undefined) settings[key] = val;
    }
    if (req.body.eventTransactionTypes !== undefined) {
      settings.eventTransactionTypes = req.body.eventTransactionTypes;
      changes.push(`eventTransactionTypes updated (${req.body.eventTransactionTypes.length} types)`);
    }
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

// Test push notification
const ONESIGNAL_APP_ID = '96cfa184-fc68-404e-a6ab-4b92fb13e6b1';
router.post('/test-push', async (req, res, next) => {
  try {
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!apiKey) return error(res, 'ONESIGNAL_REST_API_KEY not set in environment');

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { en: 'BudgetWise — Test Push' },
        contents: { en: 'If you see this, push notifications are working!' },
        url: 'https://budgetwise-f41c.onrender.com/',
      }),
    });
    const data = await response.json();

    await AuditLog.create({
      action: 'PUSH_NOTIFY', entity: 'Settings',
      details: `Test push: recipients=${data.recipients || 0}, id=${data.id || 'N/A'}${data.errors ? ', errors=' + JSON.stringify(data.errors) : ''}`,
    });

    if (data.errors) return error(res, 'OneSignal error: ' + JSON.stringify(data.errors));
    success(res, { message: `Test push sent to ${data.recipients || 0} subscriber(s)`, recipients: data.recipients || 0, id: data.id });
  } catch (err) {
    console.error('Test push error:', err.message);
    return error(res, 'Failed to send test push: ' + err.message);
  }
});

// Export all data
router.get('/export', async (req, res, next) => {
  try {
    const [settings, incomes, budgets, expenses, routines, routineEntries, savings, tags, topics, subTopics, notes, trails, trailNotes, fundEntries, auditLogs, budgetCategories, budgetTemplates, workOrders, workOrderNotes, priceItems, priceEntries, routineNotes, stockItems, stockNotes, reminders, reminderNotes, events, eventContainers, eventEntries] = await Promise.all([
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
      TrailNote.find(),
      FundEntry.find(),
      AuditLog.find(),
      BudgetCategory.find(),
      BudgetTemplate.find(),
      WorkOrder.find(),
      WorkOrderNote.find(),
      PriceItem.find(),
      PriceEntry.find(),
      RoutineNote.find(),
      StockItem.find(),
      StockNote.find(),
      Reminder.find(),
      ReminderNote.find(),
      Event.find(),
      EventContainer.find(),
      EventEntry.find(),
    ]);
    success(res, {
      exportDate: new Date().toISOString(),
      version: 1,
      settings, incomes, budgets, expenses, routines, routineEntries, savings, tags, topics, subTopics, notes, trails, trailNotes, fundEntries, auditLogs, budgetCategories, budgetTemplates, workOrders, workOrderNotes, priceItems, priceEntries, routineNotes, stockItems, stockNotes, reminders, reminderNotes, events, eventContainers, eventEntries,
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
      trailNotes: await TrailNote.find().lean(),
      fundEntries: await FundEntry.find().lean(),
      auditLogs: await AuditLog.find().lean(),
      budgetCategories: await BudgetCategory.find().lean(),
      budgetTemplates: await BudgetTemplate.find().lean(),
      workOrders: await WorkOrder.find().lean(),
      workOrderNotes: await WorkOrderNote.find().lean(),
      priceItems: await PriceItem.find().lean(),
      priceEntries: await PriceEntry.find().lean(),
      routineNotes: await RoutineNote.find().lean(),
      stockItems: await StockItem.find().lean(),
      stockNotes: await StockNote.find().lean(),
      reminders: await Reminder.find().lean(),
      reminderNotes: await ReminderNote.find().lean(),
      events: await Event.find().lean(),
      eventContainers: await EventContainer.find().lean(),
      eventEntries: await EventEntry.find().lean(),
      settings: await Settings.findOne().lean(),
    };

    try {
      // Clear all existing data
      await Promise.all([
        Income.deleteMany({}), Budget.deleteMany({}), Expense.deleteMany({}),
        Routine.deleteMany({}), RoutineEntry.deleteMany({}), Savings.deleteMany({}),
        Tag.deleteMany({}), Topic.deleteMany({}), SubTopic.deleteMany({}), Note.deleteMany({}),
        Trail.deleteMany({}), TrailNote.deleteMany({}), FundEntry.deleteMany({}), AuditLog.deleteMany({}), BudgetCategory.deleteMany({}),
        BudgetTemplate.deleteMany({}), WorkOrder.deleteMany({}), WorkOrderNote.deleteMany({}),
        PriceItem.deleteMany({}), PriceEntry.deleteMany({}),
        RoutineNote.deleteMany({}), StockItem.deleteMany({}), StockNote.deleteMany({}),
        Reminder.deleteMany({}), ReminderNote.deleteMany({}),
        Event.deleteMany({}), EventContainer.deleteMany({}), EventEntry.deleteMany({}),
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
      if (data.trailNotes?.length) await TrailNote.insertMany(data.trailNotes);
      if (data.fundEntries?.length) await FundEntry.insertMany(data.fundEntries);
      if (data.auditLogs?.length) await AuditLog.insertMany(data.auditLogs);
      if (data.budgetCategories?.length) await BudgetCategory.insertMany(data.budgetCategories);
      if (data.budgetTemplates?.length) await BudgetTemplate.insertMany(data.budgetTemplates);
      if (data.workOrders?.length) await WorkOrder.insertMany(data.workOrders);
      if (data.workOrderNotes?.length) await WorkOrderNote.insertMany(data.workOrderNotes);
      if (data.priceItems?.length) await PriceItem.insertMany(data.priceItems);
      if (data.priceEntries?.length) await PriceEntry.insertMany(data.priceEntries);
      if (data.routineNotes?.length) await RoutineNote.insertMany(data.routineNotes);
      if (data.stockItems?.length) await StockItem.insertMany(data.stockItems);
      if (data.stockNotes?.length) await StockNote.insertMany(data.stockNotes);
      if (data.reminders?.length) await Reminder.insertMany(data.reminders);
      if (data.reminderNotes?.length) await ReminderNote.insertMany(data.reminderNotes);
      if (data.events?.length) await Event.insertMany(data.events);
      if (data.eventContainers?.length) await EventContainer.insertMany(data.eventContainers);
      if (data.eventEntries?.length) await EventEntry.insertMany(data.eventEntries);

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
          routineHighlights: data.settings.routineHighlights || [],
          kanbanDueDateColors: data.settings.kanbanDueDateColors || undefined,
          menuSwipeEnabled: data.settings.menuSwipeEnabled ?? true,
          tabSwipeTrail: data.settings.tabSwipeTrail ?? true,
          tabSwipeBudget: data.settings.tabSwipeBudget ?? true,
          tabSwipeRoutines: data.settings.tabSwipeRoutines ?? true,
          tabSwipeNotes: data.settings.tabSwipeNotes ?? true,
          trailReorderEnabled: data.settings.trailReorderEnabled ?? true,
          trailReorderTaps: data.settings.trailReorderTaps ?? 2,
          trailDetailEnabled: data.settings.trailDetailEnabled ?? true,
          trailDetailTaps: data.settings.trailDetailTaps ?? 3,
          budgetLocked: data.settings.budgetLocked ?? false,
          settingsLocked: data.settings.settingsLocked ?? false,
          eventTransactionTypes: data.settings.eventTransactionTypes || [],
        }, { upsert: true });
      }

      success(res, { message: 'Data restored successfully' });
    } catch (importErr) {
      // Rollback: clear failed import data and restore snapshot
      await Promise.all([
        Income.deleteMany({}), Budget.deleteMany({}), Expense.deleteMany({}),
        Routine.deleteMany({}), RoutineEntry.deleteMany({}), Savings.deleteMany({}),
        Tag.deleteMany({}), Topic.deleteMany({}), SubTopic.deleteMany({}), Note.deleteMany({}),
        Trail.deleteMany({}), TrailNote.deleteMany({}), FundEntry.deleteMany({}), AuditLog.deleteMany({}), BudgetCategory.deleteMany({}),
        BudgetTemplate.deleteMany({}), WorkOrder.deleteMany({}), WorkOrderNote.deleteMany({}),
        PriceItem.deleteMany({}), PriceEntry.deleteMany({}),
        RoutineNote.deleteMany({}), StockItem.deleteMany({}), StockNote.deleteMany({}),
        Reminder.deleteMany({}), ReminderNote.deleteMany({}),
        Event.deleteMany({}), EventContainer.deleteMany({}), EventEntry.deleteMany({}),
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
      if (snapshot.trailNotes.length) await TrailNote.insertMany(snapshot.trailNotes);
      if (snapshot.fundEntries.length) await FundEntry.insertMany(snapshot.fundEntries);
      if (snapshot.auditLogs.length) await AuditLog.insertMany(snapshot.auditLogs);
      if (snapshot.budgetCategories.length) await BudgetCategory.insertMany(snapshot.budgetCategories);
      if (snapshot.budgetTemplates.length) await BudgetTemplate.insertMany(snapshot.budgetTemplates);
      if (snapshot.workOrders.length) await WorkOrder.insertMany(snapshot.workOrders);
      if (snapshot.workOrderNotes.length) await WorkOrderNote.insertMany(snapshot.workOrderNotes);
      if (snapshot.priceItems.length) await PriceItem.insertMany(snapshot.priceItems);
      if (snapshot.priceEntries.length) await PriceEntry.insertMany(snapshot.priceEntries);
      if (snapshot.routineNotes.length) await RoutineNote.insertMany(snapshot.routineNotes);
      if (snapshot.stockItems.length) await StockItem.insertMany(snapshot.stockItems);
      if (snapshot.stockNotes.length) await StockNote.insertMany(snapshot.stockNotes);
      if (snapshot.reminders.length) await Reminder.insertMany(snapshot.reminders);
      if (snapshot.reminderNotes.length) await ReminderNote.insertMany(snapshot.reminderNotes);
      if (snapshot.events.length) await Event.insertMany(snapshot.events);
      if (snapshot.eventContainers.length) await EventContainer.insertMany(snapshot.eventContainers);
      if (snapshot.eventEntries.length) await EventEntry.insertMany(snapshot.eventEntries);
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
      TrailNote.deleteMany({}),
      FundEntry.deleteMany({}),
      AuditLog.deleteMany({}),
      BudgetCategory.deleteMany({}),
      BudgetTemplate.deleteMany({}),
      WorkOrder.deleteMany({}),
      WorkOrderNote.deleteMany({}),
      PriceItem.deleteMany({}),
      PriceEntry.deleteMany({}),
      RoutineNote.deleteMany({}),
      StockItem.deleteMany({}),
      StockNote.deleteMany({}),
      Reminder.deleteMany({}), ReminderNote.deleteMany({}),
      Event.deleteMany({}), EventContainer.deleteMany({}), EventEntry.deleteMany({}),
    ]);
    const period = getCurrentPeriod();
    const settings = await Settings.findOneAndUpdate(
      {},
      {
        mode: 'monthly', negativeLimit: 0, currentPeriod: period,
        notificationEmail: '', emailNotificationsEnabled: true,
        theme: 'dark', trailBoldText: false, trailHighlights: [], routineHighlights: [],
        kanbanDueDateColors: { rules: [{ days: 3, color: '#f59e0b', label: 'Warning' }, { days: 1, color: '#ef4444', label: 'Danger' }], overdueColor: '#dc2626' },
        menuSwipeEnabled: true,
        tabSwipeTrail: true, tabSwipeBudget: true, tabSwipeRoutines: true, tabSwipeNotes: true,
        trailReorderEnabled: true, trailReorderTaps: 2, trailDetailEnabled: true, trailDetailTaps: 3,
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
