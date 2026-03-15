import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { success } from '../utils/response.js';

const router = Router();

// Get audit logs (paginated, with optional date and action filters)
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.action) {
      filter.action = req.query.action;
    }

    if (req.query.date) {
      const start = new Date(req.query.date + 'T00:00:00+05:00');
      const end = new Date(req.query.date + 'T23:59:59.999+05:00');
      filter.timestamp = { $gte: start, $lte: end };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    success(res, { logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// Clear all audit logs
router.delete('/', async (req, res, next) => {
  try {
    await AuditLog.deleteMany({});
    success(res, { message: 'Audit logs cleared' });
  } catch (err) { next(err); }
});

export default router;
