import { Router } from 'express';
import Savings from '../models/Savings.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';
import { rolloverPeriod } from '../utils/monthEnd.js';

const router = Router();

// Get all savings grouped by year/month
router.get('/', async (req, res, next) => {
  try {
    const savings = await Savings.find().sort({ year: -1, month: -1 });

    // Group by year then month
    const grouped = {};
    for (const s of savings) {
      if (!grouped[s.year]) grouped[s.year] = {};
      if (!grouped[s.year][s.month]) grouped[s.year][s.month] = [];
      grouped[s.year][s.month].push(s);
    }

    success(res, { savings, grouped });
  } catch (err) { next(err); }
});

// Trigger rollover for a specific period
router.post('/rollover', async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return error(res, 'Month and year are required');

    const existing = await Savings.find({ month, year });
    if (existing.length > 0) {
      return error(res, 'Rollover already completed for this period');
    }

    const entries = await rolloverPeriod(month, year);
    await AuditLog.create({ action: 'CREATE', entity: 'Savings', details: `Rollover for ${month}/${year}: ${entries.length} savings entries created` });
    success(res, { message: `Rollover complete. ${entries.length} savings entries created.`, entries });
  } catch (err) { next(err); }
});

export default router;
