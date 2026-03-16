import { Router } from 'express';
import sgMail from '@sendgrid/mail';
import WorkOrder from '../models/WorkOrder.js';
import WorkOrderNote from '../models/WorkOrderNote.js';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { success, error, round2 } from '../utils/response.js';

const router = Router();

const PKT_OFFSET = '+05:00';

const getTodayStrPKT = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
};

const getPKTComponents = (utcDate) => {
  const d = utcDate || new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = {};
  formatter.formatToParts(d).forEach(p => { parts[p.type] = p.value; });
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

const formatPKT = (date) => date.toLocaleString('en-US', {
  timeZone: 'Asia/Karachi',
  day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
});

const ONESIGNAL_APP_ID = '96cfa184-fc68-404e-a6ab-4b92fb13e6b1';

const sendPushNotification = async (title, message, url) => {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey) return { sent: false, reason: 'ONESIGNAL_REST_API_KEY not set' };
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
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
    if (data.errors) return { sent: false, reason: JSON.stringify(data.errors) };
    return { sent: true, recipients: data.recipients || 0, id: data.id };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
};

// ─── Static routes first (before /:id) ───

// Get all work orders (with search & filter)
router.get('/', async (req, res, next) => {
  try {
    const { search, priority, status, budgetType, includeArchived } = req.query;
    const filter = {};
    if (search) filter.title = { $regex: search, $options: 'i' };
    if (priority) filter.priority = priority;
    if (status) filter.status = status;
    else if (includeArchived !== 'true') filter.status = { $nin: ['archived', 'backlog'] };
    if (budgetType === 'budget') filter.budgetId = { $ne: null };
    if (budgetType === 'simple') filter.budgetId = null;

    const workOrders = await WorkOrder.find(filter).sort({ createdAt: -1 }).populate('budgetId', 'name remainingAmount allocatedAmount');
    success(res, workOrders);
  } catch (err) { next(err); }
});

// Create work order
router.post('/', async (req, res, next) => {
  try {
    const { title, priority, budgetId, budgetAmount, reminders, dueDate } = req.body;
    if (!title?.trim()) return error(res, 'Title is required');

    const wo = await WorkOrder.create({
      title: title.trim(),
      priority: priority || 'medium',
      status: 'todo',
      budgetId: budgetId || null,
      budgetAmount: budgetId ? (budgetAmount || 0) : 0,
      budgetExpenseStatus: budgetId ? 'pending' : 'none',
      dueDate: dueDate || null,
      reminders: reminders || [],
    });

    await AuditLog.create({
      action: 'CREATE', entity: 'WorkOrder', entityId: wo._id,
      details: `Created work order "${wo.title}" (priority: ${wo.priority}${budgetId ? ', budget-linked' : ''})`,
    });

    const populated = await WorkOrder.findById(wo._id).populate('budgetId', 'name remainingAmount allocatedAmount');
    success(res, populated, 201);
  } catch (err) { next(err); }
});

// Check Reminders (cron endpoint) — MUST be before /:id
router.get('/check-reminders', async (req, res, next) => {
  try {
    const realNow = new Date();
    const pkt = getPKTComponents(realNow);
    const currentDay = pkt.weekday;
    const currentHour = pkt.hour;
    const currentMin = pkt.minute;
    const todayStr = `${pkt.year}-${String(pkt.month).padStart(2, '0')}-${String(pkt.day).padStart(2, '0')}`;

    const workOrders = await WorkOrder.find({ status: { $nin: ['done', 'archived', 'backlog'] } });
    const triggered = [];

    for (const wo of workOrders) {
      let woDirty = false;
      for (const reminder of wo.reminders) {
        if (!reminder.enabled) continue;

        const [rh, rm] = reminder.time.split(':').map(Number);
        const timeDiff = (currentHour * 60 + currentMin) - (rh * 60 + rm);
        if (timeDiff < 0 || timeDiff >= 10) continue;

        const reminderKey = `${todayStr}|${reminder.time}`;
        if (reminder.lastNotifiedDate === reminderKey) continue;

        // Skip once-type reminders that have already fired
        if (reminder.type === 'once' && reminder.fired) continue;

        let matches = false;
        switch (reminder.type) {
          case 'once': matches = true; break;
          case 'daily': matches = true; break;
          case 'weekdays': matches = currentDay >= 1 && currentDay <= 5; break;
          case 'custom_days': matches = reminder.days.includes(currentDay); break;
          case 'custom_dates':
            matches = reminder.dates.some(d => new Date(d).toISOString().split('T')[0] === todayStr);
            break;
        }

        if (matches) {
          triggered.push({
            workOrderId: wo._id,
            workOrderTitle: wo.title,
            reminderTime: reminder.time,
            reminderId: reminder._id,
            message: `Work order reminder: "${wo.title}"`,
          });
          reminder.lastNotifiedDate = reminderKey;
          // Auto-disable once-type reminders after firing
          if (reminder.type === 'once') {
            reminder.fired = true;
            reminder.enabled = false;
          }
          woDirty = true;
        }
      }
      if (woDirty) await wo.save();
    }

    let emailSent = false;
    let emailSkipReason = null;
    let pushResult = null;

    if (triggered.length > 0) {
      await AuditLog.create({
        action: 'NOTIFY', entity: 'WorkOrder',
        details: `${triggered.length} work order reminder(s): ${triggered.map(t => `"${t.workOrderTitle}" at ${t.reminderTime}`).join(', ')}`,
      });

      if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
        emailSkipReason = 'SendGrid not configured';
      } else {
        const settings = await Settings.findOne();
        if (settings?.emailNotificationsEnabled === false) {
          emailSkipReason = 'notifications disabled';
        } else {
          const toEmail = settings?.notificationEmail || process.env.NOTIFICATION_EMAIL;
          if (!toEmail) {
            emailSkipReason = 'no notification email';
          } else {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            const reminderList = triggered.map(t =>
              `<li><strong>${t.workOrderTitle}</strong> — ${t.reminderTime}</li>`
            ).join('');
            const timeStr = formatPKT(new Date());

            try {
              await sgMail.send({
                to: toEmail,
                from: process.env.SENDGRID_FROM_EMAIL,
                subject: `BudgetWise — ${triggered.length} Work Order Reminder${triggered.length > 1 ? 's' : ''}`,
                html: `
                  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6C63FF; margin-bottom: 4px;">Work Order Reminders</h2>
                    <p style="color: #666; font-size: 13px; margin-bottom: 16px;">${timeStr} (PKT)</p>
                    <ul style="padding-left: 20px; line-height: 1.8;">${reminderList}</ul>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="color: #999; font-size: 12px;">Sent by BudgetWise</p>
                  </div>
                `,
              });
              emailSent = true;
              await AuditLog.create({ action: 'NOTIFY', entity: 'WorkOrder', details: `Email sent to ${toEmail}` });
            } catch (emailErr) {
              emailSkipReason = emailErr.message;
              await AuditLog.create({ action: 'ERROR', entity: 'WorkOrder', details: `Email failed: ${emailErr.message}` });
            }
          }
        }
      }

      const pushTitle = `BudgetWise — ${triggered.length} Work Order Reminder${triggered.length > 1 ? 's' : ''}`;
      const pushMessage = triggered.map(t => `${t.workOrderTitle} (${t.reminderTime})`).join(', ');
      pushResult = await sendPushNotification(pushTitle, pushMessage, 'https://budgetwise-f41c.onrender.com/');

      if (pushResult.sent) {
        await AuditLog.create({
          action: 'PUSH_NOTIFY', entity: 'WorkOrder',
          details: `Push sent to ${pushResult.recipients} subscriber(s): ${pushMessage}`,
        });
      } else {
        await AuditLog.create({
          action: 'PUSH_SKIP', entity: 'WorkOrder',
          details: `Push skipped: ${pushResult.reason}`,
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

// Notes static routes — MUST be before /:id
router.put('/notes/:noteId', async (req, res, next) => {
  try {
    const { content } = req.body;
    const note = await WorkOrderNote.findById(req.params.noteId);
    if (!note) return error(res, 'Note not found', 404);
    note.content = content;
    await note.save();

    const wo = await WorkOrder.findById(note.workOrderId);
    await AuditLog.create({
      action: 'UPDATE', entity: 'WorkOrderNote', entityId: note._id,
      details: `Updated note in work order "${wo?.title || 'unknown'}"`,
    });

    success(res, note);
  } catch (err) { next(err); }
});

router.delete('/notes/:noteId', async (req, res, next) => {
  try {
    const note = await WorkOrderNote.findByIdAndDelete(req.params.noteId);
    if (!note) return error(res, 'Note not found', 404);
    const wo = await WorkOrder.findById(note.workOrderId);

    await AuditLog.create({
      action: 'DELETE', entity: 'WorkOrderNote', entityId: note._id,
      details: `Deleted note from work order "${wo?.title || 'unknown'}"`,
    });

    success(res, { message: 'Note deleted' });
  } catch (err) { next(err); }
});

// ─── Parameterized routes (after static) ───

// Get single work order with notes
router.get('/:id', async (req, res, next) => {
  try {
    const wo = await WorkOrder.findById(req.params.id).populate('budgetId', 'name remainingAmount allocatedAmount');
    if (!wo) return error(res, 'Work order not found', 404);
    const notes = await WorkOrderNote.find({ workOrderId: wo._id }).sort({ createdAt: -1 });
    success(res, { ...wo.toObject(), notes });
  } catch (err) { next(err); }
});

// Update work order
router.put('/:id', async (req, res, next) => {
  try {
    const { title, priority, status, budgetId, budgetAmount, reminders, dueDate, locked } = req.body;
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return error(res, 'Work order not found', 404);

    // Allow lock toggle even on locked items
    if (locked !== undefined) {
      wo.locked = locked;
      await wo.save();
      const populated = await WorkOrder.findById(wo._id).populate('budgetId', 'name remainingAmount allocatedAmount');
      return success(res, populated);
    }
    if (wo.locked) return error(res, 'This work order is locked', 403);

    const changes = [];
    if (title !== undefined && title !== wo.title) { changes.push(`title: "${wo.title}" -> "${title}"`); wo.title = title; }
    if (priority !== undefined && priority !== wo.priority) { changes.push(`priority: ${wo.priority} -> ${priority}`); wo.priority = priority; }
    if (status !== undefined && status !== wo.status) { changes.push(`status: ${wo.status} -> ${status}`); wo.status = status; }
    if (budgetId !== undefined) {
      if (budgetId !== (wo.budgetId?.toString() || null)) {
        changes.push(`budget linked changed`);
        wo.budgetId = budgetId || null;
        wo.budgetExpenseStatus = budgetId ? 'pending' : 'none';
      }
    }
    if (budgetAmount !== undefined && budgetAmount !== wo.budgetAmount) {
      changes.push(`budgetAmount: ${wo.budgetAmount} -> ${budgetAmount}`);
      wo.budgetAmount = budgetAmount;
    }
    if (dueDate !== undefined) { wo.dueDate = dueDate || null; changes.push('dueDate updated'); }
    if (reminders !== undefined) { wo.reminders = reminders; changes.push(`reminders updated`); }

    await wo.save();

    if (changes.length) {
      await AuditLog.create({
        action: 'UPDATE', entity: 'WorkOrder', entityId: wo._id,
        details: `Updated work order "${wo.title}": ${changes.join(', ')}`,
      });
    }

    const populated = await WorkOrder.findById(wo._id).populate('budgetId', 'name remainingAmount allocatedAmount');
    success(res, populated);
  } catch (err) { next(err); }
});

// Move work order (drag & drop status change)
router.put('/:id/move', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['backlog', 'todo', 'doing', 'done', 'archived'].includes(status)) return error(res, 'Invalid status');
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return error(res, 'Work order not found', 404);
    if (wo.locked) return error(res, 'This work order is locked', 403);
    const oldStatus = wo.status;
    wo.status = status;
    await wo.save();

    await AuditLog.create({
      action: 'UPDATE', entity: 'WorkOrder', entityId: wo._id,
      details: `Moved work order "${wo.title}" from ${oldStatus} to ${status}`,
    });

    const populated = await WorkOrder.findById(wo._id).populate('budgetId', 'name remainingAmount allocatedAmount');
    success(res, populated);
  } catch (err) { next(err); }
});

// Duplicate work order
router.post('/duplicate/:id', async (req, res, next) => {
  try {
    const { count } = req.body;
    const copies = Math.min(Math.max(1, parseInt(count) || 1), 50);
    const source = await WorkOrder.findById(req.params.id);
    if (!source) return error(res, 'Work order not found', 404);

    const created = [];
    for (let i = 0; i < copies; i++) {
      const wo = await WorkOrder.create({
        title: source.title,
        priority: source.priority,
        status: source.status,
        budgetId: source.budgetId || null,
        budgetAmount: source.budgetAmount || 0,
        budgetExpenseStatus: source.budgetId ? 'pending' : 'none',
        dueDate: source.dueDate || null,
        reminders: source.reminders || [],
      });
      created.push(wo);
    }

    await AuditLog.create({
      action: 'CREATE', entity: 'WorkOrder',
      details: `Duplicated "${source.title}" × ${copies}`,
    });

    const populated = await WorkOrder.find({ _id: { $in: created.map(c => c._id) } })
      .populate('budgetId', 'name remainingAmount allocatedAmount');
    success(res, populated, 201);
  } catch (err) { next(err); }
});

// Bulk move work orders
router.post('/bulk-move', async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return error(res, 'ids array required');
    if (!['backlog', 'todo', 'doing', 'done', 'archived'].includes(status)) return error(res, 'Invalid status');
    await WorkOrder.updateMany({ _id: { $in: ids } }, { $set: { status } });
    await AuditLog.create({ action: 'UPDATE', entity: 'WorkOrder', details: `Bulk moved ${ids.length} work orders to ${status}` });
    const updated = await WorkOrder.find({ _id: { $in: ids } }).populate('budgetId', 'name remainingAmount allocatedAmount');
    success(res, updated);
  } catch (err) { next(err); }
});

// Bulk archive all done work orders
router.post('/bulk-archive', async (req, res, next) => {
  try {
    const result = await WorkOrder.updateMany({ status: 'done' }, { $set: { status: 'archived' } });
    await AuditLog.create({ action: 'UPDATE', entity: 'WorkOrder', details: `Bulk archived ${result.modifiedCount} done work orders` });
    success(res, { archived: result.modifiedCount });
  } catch (err) { next(err); }
});

// Delete work order
router.delete('/:id', async (req, res, next) => {
  try {
    const woCheck = await WorkOrder.findById(req.params.id);
    if (!woCheck) return error(res, 'Work order not found', 404);
    if (woCheck.locked) return error(res, 'This work order is locked', 403);
    await WorkOrder.findByIdAndDelete(req.params.id);
    await WorkOrderNote.deleteMany({ workOrderId: woCheck._id });

    await AuditLog.create({
      action: 'DELETE', entity: 'WorkOrder', entityId: woCheck._id,
      details: `Deleted work order "${woCheck.title}" and its notes`,
    });

    success(res, { message: 'Work order deleted' });
  } catch (err) { next(err); }
});

// Notes for a specific work order
router.get('/:id/notes', async (req, res, next) => {
  try {
    const notes = await WorkOrderNote.find({ workOrderId: req.params.id }).sort({ createdAt: -1 });
    success(res, notes);
  } catch (err) { next(err); }
});

router.post('/:id/notes', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return error(res, 'Note content is required');
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return error(res, 'Work order not found', 404);

    const note = await WorkOrderNote.create({ workOrderId: req.params.id, content });

    await AuditLog.create({
      action: 'CREATE', entity: 'WorkOrderNote', entityId: note._id,
      details: `Added note to work order "${wo.title}"`,
    });

    success(res, note, 201);
  } catch (err) { next(err); }
});

// Log expense to budget
router.post('/:id/log-expense', async (req, res, next) => {
  try {
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return error(res, 'Work order not found', 404);
    if (!wo.budgetId) return error(res, 'This work order is not linked to a budget');
    if (wo.budgetExpenseStatus === 'completed') return error(res, 'Expense already logged for this work order');

    const budget = await Budget.findById(wo.budgetId);
    if (!budget) return error(res, 'Linked budget not found', 404);

    const amount = round2(wo.budgetAmount);
    if (amount <= 0) return error(res, 'Budget amount must be greater than 0');

    if (budget.remainingAmount <= 0) {
      wo.budgetExpenseStatus = 'failed';
      await wo.save();
      await AuditLog.create({
        action: 'ERROR', entity: 'WorkOrder', entityId: wo._id,
        details: `Expense logging failed for "${wo.title}" — budget "${budget.name}" exhausted`,
      });
      return error(res, 'Budget exhausted. Please add funds to the budget and try again.');
    }

    if (amount > budget.remainingAmount) {
      wo.budgetExpenseStatus = 'failed';
      await wo.save();
      await AuditLog.create({
        action: 'ERROR', entity: 'WorkOrder', entityId: wo._id,
        details: `Expense logging failed for "${wo.title}" — amount ${amount} exceeds remaining ${budget.remainingAmount} in "${budget.name}"`,
      });
      return error(res, `Amount (PKR ${amount.toLocaleString()}) exceeds remaining budget (PKR ${budget.remainingAmount.toLocaleString()}). Please add funds and try again.`);
    }

    const expense = await Expense.create({
      budgetId: budget._id,
      description: wo.title,
      amount: amount,
    });
    budget.remainingAmount = round2(budget.remainingAmount - amount);
    await budget.save();

    wo.budgetExpenseStatus = 'completed';
    await wo.save();

    await AuditLog.create({
      action: 'CREATE', entity: 'Expense', entityId: expense._id,
      details: `Logged expense from work order "${wo.title}" — ${amount.toLocaleString()} PKR in "${budget.name}"`,
    });

    const populated = await WorkOrder.findById(wo._id).populate('budgetId', 'name remainingAmount allocatedAmount');
    success(res, { workOrder: populated, expense, budgetRemaining: budget.remainingAmount });
  } catch (err) { next(err); }
});

export default router;
