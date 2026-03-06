import { Router } from 'express';
import sgMail from '@sendgrid/mail';
import Routine from '../models/Routine.js';
import RoutineEntry from '../models/RoutineEntry.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
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

// --- Check Reminders (cron endpoint) — sends email via SendGrid ---

router.get('/check-reminders', async (req, res, next) => {
  try {
    const now = getNowKarachi();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];

    // notifyKey = "YYYY-MM-DD|HH:mm" — unique per day + scheduled time
    const notifyKey = `${todayStr}|${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

    const routines = await Routine.find({ dueDate: { $gte: now } });
    const triggered = [];

    for (const routine of routines) {
      let routineDirty = false;
      for (const reminder of routine.reminders) {
        if (!reminder.enabled) continue;

        const [rh, rm] = reminder.time.split(':').map(Number);
        const timeDiff = (currentHour * 60 + currentMin) - (rh * 60 + rm);
        if (timeDiff < 0 || timeDiff >= 10) continue;

        // Build the key for this specific reminder firing: date + scheduled time
        const reminderKey = `${todayStr}|${reminder.time}`;

        // Skip if already notified for this date+time
        if (reminder.lastNotifiedDate === reminderKey) continue;

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
            reminderId: reminder._id,
            message: `Time to work on "${routine.name}"!`,
          });
          // Mark as notified
          reminder.lastNotifiedDate = reminderKey;
          routineDirty = true;
        }
      }
      if (routineDirty) {
        await routine.save();
      }
    }

    // Send email notifications via SendGrid
    let emailSent = false;
    if (triggered.length > 0 && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
      const settings = await Settings.findOne();
      if (settings?.emailNotificationsEnabled === false) {
        return success(res, { triggered, emailSent: false, count: triggered.length, skipped: 'notifications disabled' });
      }
      const toEmail = settings?.notificationEmail || process.env.NOTIFICATION_EMAIL;

      if (toEmail) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const reminderList = triggered.map(t =>
          `<li><strong>${t.routineName}</strong> — scheduled at ${t.reminderTime}</li>`
        ).join('');

        const timeStr = now.toLocaleString('en-US', {
          timeZone: 'Asia/Karachi',
          day: 'numeric', month: 'short', year: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        });

        try {
          await sgMail.send({
            to: toEmail,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: `BudgetWise — ${triggered.length} Routine Reminder${triggered.length > 1 ? 's' : ''}`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #6C63FF; margin-bottom: 4px;">Routine Reminders</h2>
                <p style="color: #666; font-size: 13px; margin-bottom: 16px;">${timeStr} (PKT)</p>
                <ul style="padding-left: 20px; line-height: 1.8;">${reminderList}</ul>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px;">Sent by BudgetWise</p>
              </div>
            `,
          });
          emailSent = true;
        } catch (emailErr) {
          console.error('SendGrid error:', emailErr.message);
        }
      }
    }

    success(res, { triggered, emailSent, count: triggered.length });
  } catch (err) { next(err); }
});

// --- Delete entry (before /:id to avoid conflict) ---

router.delete('/entries/:entryId', async (req, res, next) => {
  try {
    const entry = await RoutineEntry.findByIdAndDelete(req.params.entryId);
    if (!entry) return error(res, 'Entry not found', 404);
    const routine = await Routine.findById(entry.routineId);
    await AuditLog.create({
      action: 'DELETE', entity: 'RoutineEntry', entityId: entry._id,
      details: `Deleted routine entry (${entry.status}) from "${routine?.name || 'unknown'}"`,
    });
    success(res, { message: 'Entry deleted' });
  } catch (err) { next(err); }
});

// --- Single routine CRUD (after static routes) ---

router.get('/:id', async (req, res, next) => {
  try {
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    success(res, routine);
  } catch (err) { next(err); }
});

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
    await AuditLog.create({
      action: 'CREATE', entity: 'Routine', entityId: routine._id,
      details: `Created routine "${name}" (target: ${targetEntries} entries)`,
    });
    success(res, routine, 201);
  } catch (err) { next(err); }
});

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
    await AuditLog.create({
      action: 'UPDATE', entity: 'Routine', entityId: routine._id,
      details: `Updated routine "${routine.name}"`,
    });
    success(res, routine);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const routine = await Routine.findByIdAndDelete(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    await RoutineEntry.deleteMany({ routineId: routine._id });
    await AuditLog.create({
      action: 'DELETE', entity: 'Routine', entityId: routine._id,
      details: `Deleted routine "${routine.name}" and all its entries`,
    });
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

    await AuditLog.create({
      action: 'CREATE', entity: 'RoutineEntry', entityId: entry._id,
      details: `Logged ${status || 'complete'} entry for "${routine.name}"`,
    });

    success(res, entry, 201);
  } catch (err) { next(err); }
});

// Batch log entries (quick shortcut)
router.post('/:id/entries/batch', async (req, res, next) => {
  try {
    const { status, count } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);

    const now = getNowKarachi();
    if (routine.dueDate && new Date(routine.dueDate) < now) {
      return error(res, 'Routine has expired, no more entries allowed', 400);
    }

    const n = Math.min(Math.max(1, parseInt(count) || 1), 50);
    const entryDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));

    const docs = Array.from({ length: n }, () => ({
      routineId: req.params.id,
      status: status || 'complete',
      date: entryDate,
      fieldValues: [],
      manualDate: false,
    }));

    const entries = await RoutineEntry.insertMany(docs);
    await AuditLog.create({
      action: 'CREATE', entity: 'RoutineEntry',
      details: `Batch logged ${n} ${status || 'complete'} entries for "${routine.name}"`,
    });
    success(res, entries, 201);
  } catch (err) { next(err); }
});

export default router;
