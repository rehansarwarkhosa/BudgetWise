import { Router } from 'express';
import Routine from '../models/Routine.js';
import RoutineEntry from '../models/RoutineEntry.js';
import PushSubscription from '../models/PushSubscription.js';
import { success, error } from '../utils/response.js';

const router = Router();

const getNowKarachi = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));

// Get all routines
router.get('/', async (req, res, next) => {
  try {
    const routines = await Routine.find().sort({ createdAt: -1 });
    const now = getNowKarachi();
    const routinesWithCounts = await Promise.all(
      routines.map(async (r) => {
        const entryCount = await RoutineEntry.countDocuments({ routineId: r._id });
        const completedEntries = await RoutineEntry.countDocuments({ routineId: r._id, status: 'complete' });
        const lastEntry = await RoutineEntry.findOne({ routineId: r._id }).sort({ date: -1 });
        const targetEntries = r.targetEntries || entryCount || 1;
        const progress = Math.round((completedEntries / targetEntries) * 100);
        const isExpired = r.dueDate && new Date(r.dueDate) < now;
        return { ...r.toObject(), entryCount, completedEntries, targetEntries, progress, isExpired, lastEntry };
      })
    );
    success(res, routinesWithCounts);
  } catch (err) { next(err); }
});

// --- Push Subscription ---

router.post('/subscribe', async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return error(res, 'Invalid subscription');
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys },
      { upsert: true, new: true }
    );
    success(res, { message: 'Subscribed' }, 201);
  } catch (err) { next(err); }
});

// --- Check Reminders (cron endpoint) ---

router.get('/check-reminders', async (req, res, next) => {
  try {
    const now = getNowKarachi();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];

    const routines = await Routine.find({ dueDate: { $gte: now } });
    const triggered = [];

    for (const routine of routines) {
      for (const reminder of routine.reminders) {
        if (!reminder.enabled) continue;

        const [rh, rm] = reminder.time.split(':').map(Number);
        const timeDiff = (currentHour * 60 + currentMin) - (rh * 60 + rm);
        if (timeDiff < 0 || timeDiff >= 10) continue;

        let matches = false;
        switch (reminder.type) {
          case 'daily':
            matches = true;
            break;
          case 'weekdays':
            matches = currentDay >= 1 && currentDay <= 5;
            break;
          case 'custom_days':
            matches = reminder.days.includes(currentDay);
            break;
          case 'custom_dates':
            matches = reminder.dates.some(d => new Date(d).toISOString().split('T')[0] === todayStr);
            break;
        }

        if (matches) {
          triggered.push({
            routineId: routine._id,
            routineName: routine.name,
            reminderTime: reminder.time,
            message: `Time to work on "${routine.name}"!`,
          });
        }
      }
    }

    // Send push notifications
    if (triggered.length > 0) {
      try {
        const webpush = await import('web-push');
        const subscriptions = await PushSubscription.find();

        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
          webpush.default.setVapidDetails(
            'mailto:budgetwise@example.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
          );

          for (const sub of subscriptions) {
            for (const t of triggered) {
              try {
                await webpush.default.sendNotification(sub, JSON.stringify({
                  title: `Reminder: ${t.routineName}`,
                  body: t.message,
                }));
              } catch (pushErr) {
                if (pushErr.statusCode === 410) {
                  await PushSubscription.deleteOne({ _id: sub._id });
                }
              }
            }
          }
        }
      } catch {
        // web-push not installed or VAPID not configured
      }
    }

    success(res, triggered);
  } catch (err) { next(err); }
});

// --- Delete entry (before /:id to avoid conflict) ---

router.delete('/entries/:entryId', async (req, res, next) => {
  try {
    const entry = await RoutineEntry.findByIdAndDelete(req.params.entryId);
    if (!entry) return error(res, 'Entry not found', 404);
    success(res, { message: 'Entry deleted' });
  } catch (err) { next(err); }
});

// --- Single routine CRUD (after static routes) ---

// Get single routine
router.get('/:id', async (req, res, next) => {
  try {
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    success(res, routine);
  } catch (err) { next(err); }
});

// Create routine
router.post('/', async (req, res, next) => {
  try {
    const { name, dueDate, targetEntries, fields, reminders } = req.body;
    if (!name) return error(res, 'Name is required');
    if (!dueDate) return error(res, 'Due date is required');
    if (!targetEntries || targetEntries < 1) return error(res, 'Target entries is required (min 1)');
    const routine = await Routine.create({
      name,
      dueDate,
      targetEntries,
      fields: fields || [],
      reminders: reminders || [],
    });
    success(res, routine, 201);
  } catch (err) { next(err); }
});

// Update routine
router.put('/:id', async (req, res, next) => {
  try {
    const { name, dueDate, targetEntries, fields, reminders } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    if (name) routine.name = name;
    if (dueDate !== undefined) routine.dueDate = dueDate;
    if (targetEntries !== undefined) routine.targetEntries = targetEntries;
    if (fields) routine.fields = fields;
    if (reminders !== undefined) routine.reminders = reminders;
    await routine.save();
    success(res, routine);
  } catch (err) { next(err); }
});

// Delete routine and its entries
router.delete('/:id', async (req, res, next) => {
  try {
    const routine = await Routine.findByIdAndDelete(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    await RoutineEntry.deleteMany({ routineId: routine._id });
    success(res, { message: 'Routine and entries deleted' });
  } catch (err) { next(err); }
});

// --- Routine Entries ---

router.get('/:id/entries', async (req, res, next) => {
  try {
    const entries = await RoutineEntry.find({ routineId: req.params.id }).sort({ date: -1 });
    success(res, entries);
  } catch (err) { next(err); }
});

router.post('/:id/entries', async (req, res, next) => {
  try {
    const { status, fieldValues, manualDate, date } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);

    const now = getNowKarachi();
    if (routine.dueDate && new Date(routine.dueDate) < now) {
      return error(res, 'Routine has expired, no more entries allowed', 400);
    }

    const entryDate = manualDate && date ? new Date(date) : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));

    const entry = await RoutineEntry.create({
      routineId: req.params.id,
      status: status || 'complete',
      date: entryDate,
      fieldValues: fieldValues || [],
      manualDate: !!manualDate,
    });

    success(res, entry, 201);
  } catch (err) { next(err); }
});

export default router;
