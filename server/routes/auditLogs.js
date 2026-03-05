import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { success } from '../utils/response.js';

const router = Router();

// Get audit logs (paginated)
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(),
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
