import { Router } from 'express';
import Trail from '../models/Trail.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET / — paginated, newest first
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      Trail.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Trail.countDocuments(),
    ]);

    success(res, {
      entries,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) { next(err); }
});

// POST / — create entry
router.post('/', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return error(res, 'Text is required');
    const entry = await Trail.create({ text: text.trim() });
    await AuditLog.create({ action: 'CREATE', entity: 'Trail', entityId: entry._id, details: `Created trail entry "${text.trim().slice(0, 50)}"` });
    success(res, entry, 201);
  } catch (err) { next(err); }
});

// DELETE /:id — delete single entry
router.delete('/:id', async (req, res, next) => {
  try {
    const entry = await Trail.findByIdAndDelete(req.params.id);
    if (!entry) return error(res, 'Trail entry not found', 404);
    await AuditLog.create({ action: 'DELETE', entity: 'Trail', entityId: entry._id, details: `Deleted trail entry "${entry.text.slice(0, 50)}"` });
    success(res, { message: 'Deleted' });
  } catch (err) { next(err); }
});

// DELETE / — delete all trails
router.delete('/', async (req, res, next) => {
  try {
    await Trail.deleteMany({});
    await AuditLog.create({ action: 'DELETE', entity: 'Trail', details: 'Deleted all trail entries' });
    success(res, { message: 'All trail entries deleted' });
  } catch (err) { next(err); }
});

export default router;
