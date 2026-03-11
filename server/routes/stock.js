import { Router } from 'express';
import StockItem from '../models/StockItem.js';
import StockNote from '../models/StockNote.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

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
    item.currentStock -= quantity;
    item.logs.push({ type: 'consume', quantity, note: req.body.note || '' });
    await item.save();
    await AuditLog.create({ action: 'UPDATE', entity: 'StockItem', entityId: item._id, details: `Consumed ${quantity} ${item.unit}(s) of "${item.name}" (remaining: ${item.currentStock})` });
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

// PUT /notes/:noteId
router.put('/notes/:noteId', async (req, res, next) => {
  try {
    const note = await StockNote.findById(req.params.noteId);
    if (!note) return error(res, 'Note not found', 404);
    if (req.body.content !== undefined) note.content = req.body.content;
    await note.save();
    success(res, note);
  } catch (err) { next(err); }
});

// DELETE /notes/:noteId
router.delete('/notes/:noteId', async (req, res, next) => {
  try {
    const note = await StockNote.findByIdAndDelete(req.params.noteId);
    if (!note) return error(res, 'Note not found', 404);
    success(res, { message: 'Note deleted' });
  } catch (err) { next(err); }
});

export default router;
