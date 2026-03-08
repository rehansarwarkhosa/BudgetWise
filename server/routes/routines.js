import { Router } from 'express';
import sgMail from '@sendgrid/mail';
import Routine from '../models/Routine.js';
import RoutineEntry from '../models/RoutineEntry.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// PKT is UTC+5 — all date ranges for "today" / "yesterday" in PKT must use this offset
const PKT_OFFSET = '+05:00';

// Get today's date string in PKT (for display/dedup keys only)
const getTodayStrPKT = () => {
  const now = new Date();
  // Format in PKT timezone
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // "2026-03-09"
};

// Get PKT date components from a real UTC date (for time/day calculations)
const getPKTComponents = (utcDate) => {
  const d = utcDate || new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = {};
  formatter.formatToParts(d).forEach(p => { parts[p.type] = p.value; });
  // Get day-of-week by constructing a date from the PKT date parts
  const pktDateStr = `${parts.year}-${parts.month}-${parts.day}T12:00:00${PKT_OFFSET}`;
  const weekday = new Date(pktDateStr).getDay();
  return {
    year: parseInt(parts.year),
    month: parseInt(parts.month),
    day: parseInt(parts.day),
    hour: parseInt(parts.hour === '24' ? '0' : parts.hour),
    minute: parseInt(parts.minute),
    weekday,
  };
};

// Convert a PKT date string to UTC date range
const pktDayToUTCRange = (dateStr) => {
  // dateStr is "YYYY-MM-DD" in PKT
  const start = new Date(dateStr + 'T00:00:00' + PKT_OFFSET);
  const end = new Date(dateStr + 'T23:59:59.999' + PKT_OFFSET);
  return { start, end };
};

// Format a real Date to PKT string (for emails)
const formatPKT = (date) => date.toLocaleString('en-US', {
  timeZone: 'Asia/Karachi',
  day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
});

// Send OneSignal push notification
const ONESIGNAL_APP_ID = '96cfa184-fc68-404e-a6ab-4b92fb13e6b1';

const sendPushNotification = async (title, message, url) => {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey) return { sent: false, reason: 'ONESIGNAL_REST_API_KEY not set in environment' };

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { en: title },
        contents: { en: message },
        url: url || undefined,
        chrome_web_badge: 'https://budgetwise-f41c.onrender.com/vite.svg',
      }),
    });
    const data = await response.json();
    if (data.errors) {
      return { sent: false, reason: JSON.stringify(data.errors), raw: data };
    }
    return { sent: true, recipients: data.recipients || 0, id: data.id };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
};

// Get all routines
router.get('/', async (req, res, next) => {
  try {
    const routines = await Routine.find().sort({ createdAt: -1 });
    const now = new Date();
    const todayStr = getTodayStrPKT();
    const { start: todayStart, end: todayEnd } = pktDayToUTCRange(todayStr);

    const routinesWithCounts = await Promise.all(
      routines.map(async (r) => {
        const entryCount = await RoutineEntry.countDocuments({ routineId: r._id });
        const completedEntries = await RoutineEntry.countDocuments({ routineId: r._id, status: 'complete' });
        const lastEntry = await RoutineEntry.findOne({ routineId: r._id }).sort({ date: -1 });
        const targetEntries = r.targetEntries || entryCount || 1;
        const progress = Math.round((completedEntries / targetEntries) * 100);
        const isExpired = r.dueDate && new Date(r.dueDate) < now;

        // Count today's complete entries for this routine (using proper UTC range for PKT day)
        const todayCompleteCount = await RoutineEntry.countDocuments({
          routineId: r._id,
          status: 'complete',
          date: { $gte: todayStart, $lte: todayEnd },
        });
        const maxDailyEntries = r.maxDailyEntries || 1;
        const isDoneForToday = todayCompleteCount >= maxDailyEntries;

        return {
          ...r.toObject(), entryCount, completedEntries, targetEntries,
          progress, isExpired, lastEntry,
          todayCompleteCount, maxDailyEntries, isDoneForToday,
        };
      })
    );
    success(res, routinesWithCounts);
  } catch (err) { next(err); }
});

// --- Check Reminders (cron endpoint) — sends email + push notification ---

router.get('/check-reminders', async (req, res, next) => {
  try {
    const realNow = new Date();
    const pkt = getPKTComponents(realNow);
    const currentDay = pkt.weekday;
    const currentHour = pkt.hour;
    const currentMin = pkt.minute;
    const todayStr = `${pkt.year}-${String(pkt.month).padStart(2, '0')}-${String(pkt.day).padStart(2, '0')}`;

    const routines = await Routine.find({ dueDate: { $gte: realNow } });
    const triggered = [];

    for (const routine of routines) {
      let routineDirty = false;
      for (const reminder of routine.reminders) {
        if (!reminder.enabled) continue;

        const [rh, rm] = reminder.time.split(':').map(Number);
        const timeDiff = (currentHour * 60 + currentMin) - (rh * 60 + rm);
        if (timeDiff < 0 || timeDiff >= 10) continue;

        const reminderKey = `${todayStr}|${reminder.time}`;
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
          reminder.lastNotifiedDate = reminderKey;
          routineDirty = true;
        }
      }
      if (routineDirty) {
        await routine.save();
      }
    }

    let emailSent = false;
    let emailSkipReason = null;
    let pushResult = null;

    if (triggered.length > 0) {
      await AuditLog.create({
        action: 'NOTIFY', entity: 'Routine',
        details: `${triggered.length} reminder(s) triggered: ${triggered.map(t => `"${t.routineName}" at ${t.reminderTime}`).join(', ')}`,
      });

      // --- Send Email via SendGrid ---
      if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
        emailSkipReason = 'SENDGRID_API_KEY or SENDGRID_FROM_EMAIL not set in environment';
        console.error('Email skipped:', emailSkipReason);
      } else {
        const settings = await Settings.findOne();
        if (settings?.emailNotificationsEnabled === false) {
          emailSkipReason = 'notifications disabled in settings';
        } else {
          const toEmail = settings?.notificationEmail || process.env.NOTIFICATION_EMAIL;
          if (!toEmail) {
            emailSkipReason = 'no notification email configured';
          } else {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);

            const reminderList = triggered.map(t =>
              `<li><strong>${t.routineName}</strong> — scheduled at ${t.reminderTime}</li>`
            ).join('');

            const timeStr = formatPKT(new Date());

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

              await AuditLog.create({
                action: 'NOTIFY', entity: 'Routine',
                details: `Email sent to ${toEmail}`,
              });
            } catch (emailErr) {
              emailSkipReason = emailErr.message;
              console.error('SendGrid error:', emailErr.message);
              await AuditLog.create({
                action: 'ERROR', entity: 'Routine',
                details: `Email failed to ${toEmail}: ${emailErr.message}`,
              });
            }
          }
        }
      }

      // --- Send Push Notification via OneSignal ---
      const pushTitle = `BudgetWise — ${triggered.length} Reminder${triggered.length > 1 ? 's' : ''}`;
      const pushMessage = triggered.map(t => `${t.routineName} (${t.reminderTime})`).join(', ');
      pushResult = await sendPushNotification(
        pushTitle,
        pushMessage,
        'https://budgetwise-f41c.onrender.com/routines'
      );

      if (pushResult.sent) {
        await AuditLog.create({
          action: 'PUSH_NOTIFY', entity: 'Routine',
          details: `Push notification sent to ${pushResult.recipients} subscriber(s): ${pushMessage}`,
        });
      } else {
        await AuditLog.create({
          action: 'PUSH_SKIP', entity: 'Routine',
          details: `Push notification skipped: ${pushResult.reason}`,
        });
      }
    }

    success(res, {
      triggered, emailSent, count: triggered.length,
      ...(emailSkipReason ? { emailSkipReason } : {}),
      pushNotification: pushResult,
    });
  } catch (err) { next(err); }
});

// --- Auto-incomplete: mark missing entries for yesterday ---
router.post('/auto-incomplete', async (req, res, next) => {
  try {
    const todayStr = getTodayStrPKT();
    // Yesterday in PKT
    const todayDate = new Date(todayStr + 'T12:00:00' + PKT_OFFSET);
    todayDate.setDate(todayDate.getDate() - 1);
    const yStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(todayDate);
    const { start: yStart, end: yEnd } = pktDayToUTCRange(yStr);

    // Get day-of-week for yesterday in PKT
    const yDow = todayDate.getDay();

    const routines = await Routine.find({ dueDate: { $gte: yStart } });
    let totalIncomplete = 0;

    for (const routine of routines) {
      const maxDaily = routine.maxDailyEntries || 1;
      const yesterdayCompleteCount = await RoutineEntry.countDocuments({
        routineId: routine._id,
        status: 'complete',
        date: { $gte: yStart, $lte: yEnd },
      });

      const missing = maxDaily - yesterdayCompleteCount;
      if (missing > 0) {
        let shouldCount = false;

        if (routine.reminders.length === 0) {
          shouldCount = true;
        } else {
          for (const rem of routine.reminders) {
            if (!rem.enabled) continue;
            switch (rem.type) {
              case 'daily': shouldCount = true; break;
              case 'weekdays': if (yDow >= 1 && yDow <= 5) shouldCount = true; break;
              case 'custom_days': if (rem.days.includes(yDow)) shouldCount = true; break;
              case 'custom_dates':
                if (rem.dates.some(d => new Date(d).toISOString().split('T')[0] === yStr)) shouldCount = true;
                break;
            }
            if (shouldCount) break;
          }
        }

        if (shouldCount) {
          // Store incomplete entries at end of yesterday in proper UTC
          const incompleteDate = new Date(yStr + 'T23:59:00' + PKT_OFFSET);
          const docs = Array.from({ length: missing }, () => ({
            routineId: routine._id,
            status: 'incomplete',
            date: incompleteDate,
            fieldValues: [],
            manualDate: false,
          }));
          await RoutineEntry.insertMany(docs);
          totalIncomplete += missing;
        }
      }
    }

    if (totalIncomplete > 0) {
      await AuditLog.create({
        action: 'AUTO_INCOMPLETE', entity: 'RoutineEntry',
        details: `Auto-marked ${totalIncomplete} missing entries as incomplete for ${yStr}`,
      });
    }

    success(res, { date: yStr, totalIncomplete });
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
    const { name, dueDate, targetEntries, maxDailyEntries, fields, reminders } = req.body;
    if (!name) return error(res, 'Name is required');
    if (!dueDate) return error(res, 'Due date is required');
    if (!targetEntries || targetEntries < 1) return error(res, 'Target entries is required (min 1)');
    const routine = await Routine.create({
      name,
      dueDate,
      targetEntries,
      maxDailyEntries: maxDailyEntries || 1,
      fields: fields || [],
      reminders: reminders || [],
    });
    await AuditLog.create({
      action: 'CREATE', entity: 'Routine', entityId: routine._id,
      details: `Created routine "${name}" (target: ${targetEntries}, daily max: ${maxDailyEntries || 1})`,
    });
    success(res, routine, 201);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, dueDate, targetEntries, maxDailyEntries, fields, reminders } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    if (name) routine.name = name;
    if (dueDate !== undefined) routine.dueDate = dueDate;
    if (targetEntries !== undefined) routine.targetEntries = targetEntries;
    if (maxDailyEntries !== undefined) routine.maxDailyEntries = maxDailyEntries;
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
    const { fieldValues, manualDate, date } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);

    if (routine.dueDate && new Date(routine.dueDate) < new Date()) {
      return error(res, 'Routine has expired, no more entries allowed', 400);
    }

    // Check if daily limit reached
    const todayStr = getTodayStrPKT();
    const { start: todayStart, end: todayEnd } = pktDayToUTCRange(todayStr);
    const todayCompleteCount = await RoutineEntry.countDocuments({
      routineId: routine._id,
      status: 'complete',
      date: { $gte: todayStart, $lte: todayEnd },
    });
    const maxDaily = routine.maxDailyEntries || 1;
    if (todayCompleteCount >= maxDaily && !manualDate) {
      return error(res, `Daily limit reached (${maxDaily}/${maxDaily}). Already done for today.`, 400);
    }

    // Use real UTC time — frontend formats it to PKT for display
    const entryDate = manualDate && date ? new Date(date) : new Date();

    const entry = await RoutineEntry.create({
      routineId: req.params.id,
      status: 'complete',
      date: entryDate,
      fieldValues: fieldValues || [],
      manualDate: !!manualDate,
    });

    await AuditLog.create({
      action: 'CREATE', entity: 'RoutineEntry', entityId: entry._id,
      details: `Logged complete entry for "${routine.name}"`,
    });

    success(res, entry, 201);
  } catch (err) { next(err); }
});

// Batch log entries — always complete
router.post('/:id/entries/batch', async (req, res, next) => {
  try {
    const { count } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);

    if (routine.dueDate && new Date(routine.dueDate) < new Date()) {
      return error(res, 'Routine has expired, no more entries allowed', 400);
    }

    const n = Math.min(Math.max(1, parseInt(count) || 1), 50);
    // Use real UTC time
    const entryDate = new Date();

    const docs = Array.from({ length: n }, () => ({
      routineId: req.params.id,
      status: 'complete',
      date: entryDate,
      fieldValues: [],
      manualDate: false,
    }));

    const entries = await RoutineEntry.insertMany(docs);
    await AuditLog.create({
      action: 'CREATE', entity: 'RoutineEntry',
      details: `Batch logged ${n} complete entries for "${routine.name}"`,
    });
    success(res, entries, 201);
  } catch (err) { next(err); }
});

export default router;
