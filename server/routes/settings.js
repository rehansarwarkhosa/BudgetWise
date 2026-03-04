import { Router } from 'express';
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
    const { mode, negativeLimit, currentPeriod, notificationEmail, theme } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      const period = getCurrentPeriod();
      settings = await Settings.create({ mode: 'monthly', negativeLimit: 0, currentPeriod: period });
    }
    if (mode !== undefined) settings.mode = mode;
    if (negativeLimit !== undefined) settings.negativeLimit = negativeLimit;
    if (currentPeriod) settings.currentPeriod = currentPeriod;
    if (notificationEmail !== undefined) settings.notificationEmail = notificationEmail;
    if (theme !== undefined) settings.theme = theme;
    await settings.save();
    success(res, settings);
  } catch (err) { next(err); }
});

// Export all data
router.get('/export', async (req, res, next) => {
  try {
    const [settings, incomes, budgets, expenses, routines, routineEntries, savings, tags, topics, subTopics, notes, trails] = await Promise.all([
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
    ]);
    success(res, {
      exportDate: new Date().toISOString(),
      version: 1,
      settings, incomes, budgets, expenses, routines, routineEntries, savings, tags, topics, subTopics, notes, trails,
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
      settings: await Settings.findOne().lean(),
    };

    try {
      // Clear all existing data
      await Promise.all([
        Income.deleteMany({}), Budget.deleteMany({}), Expense.deleteMany({}),
        Routine.deleteMany({}), RoutineEntry.deleteMany({}), Savings.deleteMany({}),
        Tag.deleteMany({}), Topic.deleteMany({}), SubTopic.deleteMany({}), Note.deleteMany({}),
        Trail.deleteMany({}),
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

      if (data.settings) {
        await Settings.findOneAndUpdate({}, {
          mode: data.settings.mode,
          negativeLimit: data.settings.negativeLimit,
          currentPeriod: data.settings.currentPeriod,
          notificationEmail: data.settings.notificationEmail || '',
          theme: data.settings.theme || 'dark',
        }, { upsert: true });
      }

      success(res, { message: 'Data restored successfully' });
    } catch (importErr) {
      // Rollback: clear failed import data and restore snapshot
      await Promise.all([
        Income.deleteMany({}), Budget.deleteMany({}), Expense.deleteMany({}),
        Routine.deleteMany({}), RoutineEntry.deleteMany({}), Savings.deleteMany({}),
        Tag.deleteMany({}), Topic.deleteMany({}), SubTopic.deleteMany({}), Note.deleteMany({}),
        Trail.deleteMany({}),
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
    ]);
    const period = getCurrentPeriod();
    const settings = await Settings.findOneAndUpdate(
      {},
      { mode: 'monthly', negativeLimit: 0, currentPeriod: period },
      { new: true, upsert: true }
    );
    success(res, { message: 'All data deleted', settings });
  } catch (err) { next(err); }
});

export default router;
