import { Router } from 'express';
import Reminder from '../models/Reminder.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET / — list reminders, optionally filter by status
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status && status !== 'all') {
      if (status === 'upcoming') {
        query.status = 'active';
      } else {
        query.status = status;
      }
    }
    if (search?.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { note: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const reminders = await Reminder.find(query).sort({ createdAt: -1 });

    // Auto-expire: for 'once' reminders that have fired, mark as expired
    const now = new Date();
    const bulkOps = [];
    for (const r of reminders) {
      if (r.status === 'active' && r.schedule.type === 'once' && r.schedule.fired) {
        r.status = 'expired';
        bulkOps.push({ updateOne: { filter: { _id: r._id }, update: { status: 'expired' } } });
      }
      // Auto-expire custom_dates if all dates have passed
      if (r.status === 'active' && r.schedule.type === 'custom_dates' && r.schedule.dates?.length > 0) {
        const allPast = r.schedule.dates.every(d => new Date(d) < now);
        if (allPast) {
          r.status = 'expired';
          bulkOps.push({ updateOne: { filter: { _id: r._id }, update: { status: 'expired' } } });
        }
      }
      // Unsnooze if snooze time has passed
      if (r.status === 'snoozed' && r.snoozeUntil && new Date(r.snoozeUntil) <= now) {
        r.status = 'active';
        r.snoozeUntil = null;
        bulkOps.push({ updateOne: { filter: { _id: r._id }, update: { status: 'active', snoozeUntil: null } } });
      }
    }
    if (bulkOps.length) await Reminder.bulkWrite(bulkOps);

    success(res, reminders);
  } catch (err) { next(err); }
});

// POST / — create reminder
router.post('/', async (req, res, next) => {
  try {
    const { title, note, priority, schedule } = req.body;
    if (!title?.trim()) return error(res, 'Title is required');
    if (!schedule?.type || !schedule?.time) return error(res, 'Schedule type and time are required');

    const reminder = await Reminder.create({
      title: title.trim(),
      note: note?.trim() || '',
      priority: priority || 'medium',
      schedule,
    });

    await AuditLog.create({
      action: 'CREATE', entity: 'Reminder', entityId: reminder._id,
      details: `Created reminder "${title.trim().slice(0, 50)}"`,
    });

    success(res, reminder, 201);
  } catch (err) { next(err); }
});

// PUT /:id — update reminder
router.put('/:id', async (req, res, next) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return error(res, 'Reminder not found', 404);

    const { title, note, priority, schedule, status, snoozeUntil } = req.body;
    const changes = [];

    if (title !== undefined) { reminder.title = title.trim(); changes.push('title'); }
    if (note !== undefined) { reminder.note = note.trim(); changes.push('note'); }
    if (priority !== undefined) { reminder.priority = priority; changes.push('priority'); }
    if (schedule !== undefined) { reminder.schedule = schedule; changes.push('schedule'); }
    if (status !== undefined) {
      reminder.status = status;
      if (status === 'completed') reminder.completedAt = new Date();
      if (status === 'snoozed' && snoozeUntil) reminder.snoozeUntil = new Date(snoozeUntil);
      changes.push(`status→${status}`);
    }

    await reminder.save();
    if (changes.length) {
      await AuditLog.create({
        action: 'UPDATE', entity: 'Reminder', entityId: reminder._id,
        details: `Updated reminder: ${changes.join(', ')}`,
      });
    }
    success(res, reminder);
  } catch (err) { next(err); }
});

// DELETE /:id
router.delete('/:id', async (req, res, next) => {
  try {
    const reminder = await Reminder.findByIdAndDelete(req.params.id);
    if (!reminder) return error(res, 'Reminder not found', 404);
    await AuditLog.create({
      action: 'DELETE', entity: 'Reminder', entityId: reminder._id,
      details: `Deleted reminder "${reminder.title.slice(0, 50)}"`,
    });
    success(res, { message: 'Deleted' });
  } catch (err) { next(err); }
});

// PUT /:id/toggle — quick toggle active/completed
router.put('/:id/toggle', async (req, res, next) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return error(res, 'Reminder not found', 404);

    if (reminder.status === 'completed') {
      reminder.status = 'active';
      reminder.completedAt = null;
      // Reset fired for 'once' type
      if (reminder.schedule.type === 'once') {
        reminder.schedule.fired = false;
        reminder.schedule.enabled = true;
      }
    } else {
      reminder.status = 'completed';
      reminder.completedAt = new Date();
    }
    await reminder.save();
    await AuditLog.create({
      action: 'UPDATE', entity: 'Reminder', entityId: reminder._id,
      details: `Toggled reminder to ${reminder.status}`,
    });
    success(res, reminder);
  } catch (err) { next(err); }
});

export default router;
