import { Router } from 'express';
import sgMail from '@sendgrid/mail';
import StockItem from '../models/StockItem.js';
import StockNote from '../models/StockNote.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

const ONESIGNAL_APP_ID = '96cfa184-fc68-404e-a6ab-4b92fb13e6b1';

const sendPushNotification = async (title, message, url) => {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey) return { sent: false, reason: 'ONESIGNAL_REST_API_KEY not set' };
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID, included_segments: ['All'],
        headings: { en: title }, contents: { en: message },
        url: url || undefined,
        chrome_web_badge: `${process.env.APP_URL}/vite.svg`,
      }),
    });
    const data = await response.json();
    if (data.errors) return { sent: false, reason: JSON.stringify(data.errors) };
    return { sent: true, recipients: data.recipients || 0, id: data.id };
  } catch (err) { return { sent: false, reason: err.message }; }
};

const sendStockAlert = async (items) => {
  if (!items.length) return;
  const alertList = items.map(i => `"${i.name}" — ${i.currentStock} ${i.unit}(s) remaining${i.currentStock <= 0 ? ' (EMPTY)' : ' (LOW)'}`);

  // Push notification
  const pushTitle = `BudgetWise — ${items.length} Stock Alert${items.length > 1 ? 's' : ''}`;
  const pushMessage = items.map(i => `${i.name}: ${i.currentStock} ${i.unit}(s)`).join(', ');
  const pushResult = await sendPushNotification(pushTitle, pushMessage, `${process.env.APP_URL}/budget`);

  if (pushResult.sent) {
    await AuditLog.create({ action: 'PUSH_NOTIFY', entity: 'StockItem', details: `Stock alert push sent: ${pushMessage}` });
  }

  // Email notification
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return;
  const settings = await Settings.findOne();
  if (settings?.emailNotificationsEnabled === false) return;
  const toEmail = settings?.notificationEmail || process.env.NOTIFICATION_EMAIL;
  if (!toEmail) return;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const timeStr = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const listHtml = alertList.map(a => `<li>${a}</li>`).join('');

  try {
    await sgMail.send({
      to: toEmail, from: process.env.SENDGRID_FROM_EMAIL,
      subject: `BudgetWise — ${items.length} Stock Alert${items.length > 1 ? 's' : ''}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #EF4444; margin-bottom: 4px;">Stock Alert</h2>
          <p style="color: #666; font-size: 13px; margin-bottom: 16px;">${timeStr} (PKT)</p>
          <ul style="padding-left: 20px; line-height: 1.8;">${listHtml}</ul>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Sent by BudgetWise</p>
        </div>
      `,
    });
    await AuditLog.create({ action: 'NOTIFY', entity: 'StockItem', details: `Stock alert email sent to ${toEmail}` });
  } catch (emailErr) {
    await AuditLog.create({ action: 'ERROR', entity: 'StockItem', details: `Stock alert email failed: ${emailErr.message}` });
  }
};

// GET / - List all stock items (with computed status)
router.get('/', async (req, res, next) => {
  try {
    const { status, search, category } = req.query;
    let query = {};
    if (category && category !== 'all') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    let items = await StockItem.find(query).sort({ sortOrder: 1, name: 1 });

    // Compute status for each
    items = items.map(item => {
      const obj = item.toObject();
      if (obj.currentStock <= 0) obj.status = 'empty';
      else if (obj.currentStock <= obj.minStock) obj.status = 'low';
      else obj.status = 'in_stock';
      return obj;
    });

    if (status && status !== 'all') {
      items = items.filter(i => i.status === status);
    }

    success(res, items);
  } catch (err) { next(err); }
});

// GET /check-alerts - Cron endpoint: notify about all low/empty stock
router.get('/check-alerts', async (req, res, next) => {
  try {
    const items = await StockItem.find({ minStock: { $gt: 0 } });
    const alertItems = items.filter(i => i.currentStock <= i.minStock);
    if (alertItems.length > 0) {
      await sendStockAlert(alertItems);
      await AuditLog.create({
        action: 'NOTIFY', entity: 'StockItem',
        details: `Stock check: ${alertItems.length} item(s) low/empty — ${alertItems.map(i => `"${i.name}" (${i.currentStock})`).join(', ')}`,
      });
    }
    success(res, { alertCount: alertItems.length, items: alertItems.map(i => ({ name: i.name, currentStock: i.currentStock, minStock: i.minStock, unit: i.unit })) });
  } catch (err) { next(err); }
});

// Also add /notes/:noteId routes before /:id to prevent conflicts
router.put('/notes/:noteId', async (req, res, next) => {
  try {
    const note = await StockNote.findById(req.params.noteId);
    if (!note) return error(res, 'Note not found', 404);
    if (req.body.content !== undefined) note.content = req.body.content;
    await note.save();
    success(res, note);
  } catch (err) { next(err); }
});

router.delete('/notes/:noteId', async (req, res, next) => {
  try {
    const note = await StockNote.findByIdAndDelete(req.params.noteId);
    if (!note) return error(res, 'Note not found', 404);
    success(res, { message: 'Note deleted' });
  } catch (err) { next(err); }
});

// GET /:id - Single stock item
router.get('/:id', async (req, res, next) => {
  try {
    const item = await StockItem.findById(req.params.id);
    if (!item) return error(res, 'Stock item not found', 404);
    const obj = item.toObject();
    if (obj.currentStock <= 0) obj.status = 'empty';
    else if (obj.currentStock <= obj.minStock) obj.status = 'low';
    else obj.status = 'in_stock';
    success(res, obj);
  } catch (err) { next(err); }
});

// POST / - Create stock item
router.post('/', async (req, res, next) => {
  try {
    const { name, category, unit, currentStock, minStock } = req.body;
    if (!name?.trim()) return error(res, 'Name is required');
    const item = await StockItem.create({
      name: name.trim(), category: category || 'General',
      unit: unit || 'unit', currentStock: currentStock || 0,
      minStock: minStock || 0,
    });
    await AuditLog.create({ action: 'CREATE', entity: 'StockItem', entityId: item._id, details: `Created stock item "${name.trim()}" (${currentStock || 0} ${unit || 'unit'}s)` });
    success(res, item, 201);
  } catch (err) { next(err); }
});

// PUT /:id - Update stock item
router.put('/:id', async (req, res, next) => {
  try {
    const item = await StockItem.findById(req.params.id);
    if (!item) return error(res, 'Stock item not found', 404);
    const { name, category, unit, currentStock, minStock } = req.body;
    if (name !== undefined) item.name = name;
    if (category !== undefined) item.category = category;
    if (unit !== undefined) item.unit = unit;
    if (currentStock !== undefined) item.currentStock = currentStock;
    if (minStock !== undefined) item.minStock = minStock;
    await item.save();
    await AuditLog.create({ action: 'UPDATE', entity: 'StockItem', entityId: item._id, details: `Updated stock item "${item.name}"` });
    success(res, item);
  } catch (err) { next(err); }
});

// DELETE /:id - Delete stock item and its notes
router.delete('/:id', async (req, res, next) => {
  try {
    const item = await StockItem.findByIdAndDelete(req.params.id);
    if (!item) return error(res, 'Stock item not found', 404);
    await StockNote.deleteMany({ stockItemId: item._id });
    await AuditLog.create({ action: 'DELETE', entity: 'StockItem', entityId: item._id, details: `Deleted stock item "${item.name}"` });
    success(res, { message: 'Stock item deleted' });
  } catch (err) { next(err); }
});

// POST /:id/consume - Consume units
router.post('/:id/consume', async (req, res, next) => {
  try {
    const item = await StockItem.findById(req.params.id);
    if (!item) return error(res, 'Stock item not found', 404);
    const quantity = Number(req.body.quantity) || 1;
    if (item.currentStock < quantity) return error(res, `Not enough stock (have ${item.currentStock})`, 400);
    const wasSafe = item.currentStock > item.minStock;
    item.currentStock -= quantity;
    item.logs.push({ type: 'consume', quantity, note: req.body.note || '' });
    await item.save();
    await AuditLog.create({ action: 'UPDATE', entity: 'StockItem', entityId: item._id, details: `Consumed ${quantity} ${item.unit}(s) of "${item.name}" (remaining: ${item.currentStock})` });

    // Send alert if stock just crossed the low/empty threshold
    if (wasSafe && item.minStock > 0 && item.currentStock <= item.minStock) {
      sendStockAlert([item]).catch(() => {});
    } else if (item.currentStock <= 0) {
      sendStockAlert([item]).catch(() => {});
    }

    success(res, item);
  } catch (err) { next(err); }
});

// POST /:id/refill - Refill stock
router.post('/:id/refill', async (req, res, next) => {
  try {
    const item = await StockItem.findById(req.params.id);
    if (!item) return error(res, 'Stock item not found', 404);
    const quantity = Number(req.body.quantity) || 1;
    item.currentStock += quantity;
    item.logs.push({ type: 'refill', quantity, note: req.body.note || '' });
    await item.save();
    await AuditLog.create({ action: 'UPDATE', entity: 'StockItem', entityId: item._id, details: `Refilled ${quantity} ${item.unit}(s) of "${item.name}" (total: ${item.currentStock})` });
    success(res, item);
  } catch (err) { next(err); }
});

// --- Stock Notes (same pattern as work order notes) ---

// GET /:id/notes
router.get('/:id/notes', async (req, res, next) => {
  try {
    const notes = await StockNote.find({ stockItemId: req.params.id }).sort({ createdAt: -1 });
    success(res, notes);
  } catch (err) { next(err); }
});

// POST /:id/notes
router.post('/:id/notes', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return error(res, 'Note content is required');
    const note = await StockNote.create({ stockItemId: req.params.id, content });
    success(res, note, 201);
  } catch (err) { next(err); }
});

export default router;
