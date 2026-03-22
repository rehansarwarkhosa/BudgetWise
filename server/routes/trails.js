import { Router } from 'express';
import Trail from '../models/Trail.js';
import TrailNote from '../models/TrailNote.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET / — date-range based pagination (30 days per page), newest first, optional search + filter
router.get('/', async (req, res, next) => {
  try {
    const daysPerPage = Math.min(365, Math.max(1, parseInt(req.query.daysPerPage) || 30));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = req.query.search?.trim();
    const filter = req.query.filter || 'all'; // 'all', 'with_reminders', 'plain'
    const date = req.query.date?.trim(); // 'today' or 'YYYY-MM-DD'

    const query = {};
    if (search) query.text = { $regex: search, $options: 'i' };
    if (filter === 'with_reminders') query['reminders.0'] = { $exists: true };
    else if (filter === 'plain') query['reminders.0'] = { $exists: false };
    else if (filter === 'starred') query.highlighted = true;

    if (date) {
      // Single-day filter — return all entries for that day
      let dateStr = date;
      if (date === 'today') {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      const dayStart = new Date(dateStr + 'T00:00:00+05:00');
      const dayEnd = new Date(dateStr + 'T23:59:59.999+05:00');
      query.createdAt = { $gte: dayStart, $lte: dayEnd };

      const [entries, total] = await Promise.all([
        Trail.find(query).sort({ createdAt: -1 }),
        Trail.countDocuments(query),
      ]);

      // Sort within each day by sortOrder (entries already grouped by day from query)
      entries.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || new Date(b.createdAt) - new Date(a.createdAt));

      return success(res, { entries, page: 1, totalPages: 1, total, hasMore: false });
    }

    // Date-range based pagination: page 1 = last 30 days, page 2 = 31-60 days ago, etc.
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const rangeEndDaysAgo = (page - 1) * daysPerPage;
    const rangeStartDaysAgo = page * daysPerPage;

    // Compute date strings in PKT, then create proper UTC boundaries
    const endDate = new Date(todayStr + 'T12:00:00+05:00');
    endDate.setDate(endDate.getDate() - rangeEndDaysAgo);
    const endDateStr = endDate.toISOString().split('T')[0];
    const rangeEnd = new Date(endDateStr + 'T23:59:59.999+05:00');

    const startDate = new Date(todayStr + 'T12:00:00+05:00');
    startDate.setDate(startDate.getDate() - rangeStartDaysAgo);
    const startDateStr = startDate.toISOString().split('T')[0];
    const rangeStart = new Date(startDateStr + 'T00:00:00+05:00');

    query.createdAt = { $gte: rangeStart, $lte: rangeEnd };

    const entries = await Trail.find(query).sort({ createdAt: -1 });

    // Check if there are older entries beyond this range (preserve search/filter)
    const olderQuery = {};
    if (query.text) olderQuery.text = query.text;
    if (query['reminders.0']) olderQuery['reminders.0'] = query['reminders.0'];
    olderQuery.createdAt = { $lt: rangeStart };
    const olderCount = await Trail.countDocuments(olderQuery);
    const hasMore = olderCount > 0;

    success(res, {
      entries,
      page,
      hasMore,
      total: entries.length,
    });
  } catch (err) { next(err); }
});

// POST / — create entry
router.post('/', async (req, res, next) => {
  try {
    const { text, quickPhrase } = req.body;
    if (!text?.trim()) return error(res, 'Text is required');
    const entry = await Trail.create({ text: text.trim(), ...(quickPhrase ? { quickPhrase: true } : {}) });
    await AuditLog.create({ action: 'CREATE', entity: 'Trail', entityId: entry._id, details: `Created trail entry "${text.trim().slice(0, 50)}"` });
    success(res, entry, 201);
  } catch (err) { next(err); }
});

// POST /reorder — reorder trail entries within a day
router.post('/reorder', async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return error(res, 'orderedIds array required');
    const bulk = orderedIds.map((id, idx) => ({
      updateOne: { filter: { _id: id }, update: { sortOrder: idx } },
    }));
    await Trail.bulkWrite(bulk);
    await AuditLog.create({ action: 'UPDATE', entity: 'Trail', details: `Reordered ${orderedIds.length} trail entries` });
    success(res, { message: 'Reordered' });
  } catch (err) { next(err); }
});

// --- Trail Notes (static routes MUST be before /:id) ---

// PUT /notes/:noteId
router.put('/notes/:noteId', async (req, res, next) => {
  try {
    const note = await TrailNote.findByIdAndUpdate(req.params.noteId, { content: req.body.content }, { new: true });
    if (!note) return error(res, 'Note not found', 404);
    await AuditLog.create({ action: 'UPDATE', entity: 'TrailNote', entityId: note._id, details: 'Trail note updated' });
    success(res, note);
  } catch (err) { next(err); }
});

// DELETE /notes/:noteId
router.delete('/notes/:noteId', async (req, res, next) => {
  try {
    const note = await TrailNote.findByIdAndDelete(req.params.noteId);
    if (!note) return error(res, 'Note not found', 404);
    await AuditLog.create({ action: 'DELETE', entity: 'TrailNote', entityId: note._id, details: 'Trail note deleted' });
    success(res, { message: 'Deleted' });
  } catch (err) { next(err); }
});

// --- Parameterized routes ---

// PUT /:id — update trail (reminders, text)
router.put('/:id', async (req, res, next) => {
  try {
    const trail = await Trail.findById(req.params.id);
    if (!trail) return error(res, 'Trail entry not found', 404);
    const changes = [];
    if (req.body.text !== undefined) { trail.text = req.body.text; changes.push('text updated'); }
    if (req.body.highlighted !== undefined) { trail.highlighted = req.body.highlighted; changes.push(`highlighted: ${trail.highlighted}`); }
    if (req.body.reminders !== undefined) { trail.reminders = req.body.reminders; changes.push(`reminders updated (${req.body.reminders.length})`); }
    if (req.body.adjustedAt !== undefined) {
      const oldDate = trail.createdAt;
      trail.createdAt = new Date(req.body.adjustedAt);
      trail.adjustedAt = new Date();
      trail.sortOrder = 0;
      const oldStr = oldDate.toLocaleString('en-US', { timeZone: 'Asia/Karachi', dateStyle: 'short', timeStyle: 'short' });
      const newStr = trail.createdAt.toLocaleString('en-US', { timeZone: 'Asia/Karachi', dateStyle: 'short', timeStyle: 'short' });
      changes.push(`time adjusted: ${oldStr} → ${newStr}`);
    }
    await trail.save();
    if (changes.length) {
      await AuditLog.create({ action: 'UPDATE', entity: 'Trail', entityId: trail._id, details: changes.join(', ') });
    }
    success(res, trail);
  } catch (err) { next(err); }
});

// GET /:id/notes
router.get('/:id/notes', async (req, res, next) => {
  try {
    const notes = await TrailNote.find({ trailId: req.params.id }).sort({ createdAt: -1 });
    success(res, notes);
  } catch (err) { next(err); }
});

// POST /:id/notes
router.post('/:id/notes', async (req, res, next) => {
  try {
    const trail = await Trail.findById(req.params.id);
    if (!trail) return error(res, 'Trail not found', 404);
    const note = await TrailNote.create({ trailId: req.params.id, content: req.body.content || '' });
    await AuditLog.create({ action: 'CREATE', entity: 'TrailNote', entityId: note._id, details: `Added note to trail "${trail.text.slice(0, 50)}"` });
    success(res, note, 201);
  } catch (err) { next(err); }
});

// DELETE /:id — delete single entry
router.delete('/:id', async (req, res, next) => {
  try {
    const entry = await Trail.findByIdAndDelete(req.params.id);
    if (!entry) return error(res, 'Trail entry not found', 404);
    await TrailNote.deleteMany({ trailId: entry._id });
    await AuditLog.create({ action: 'DELETE', entity: 'Trail', entityId: entry._id, details: `Deleted trail entry "${entry.text.slice(0, 50)}"` });
    success(res, { message: 'Deleted' });
  } catch (err) { next(err); }
});

// DELETE / — delete all trails
router.delete('/', async (req, res, next) => {
  try {
    await Trail.deleteMany({});
    await TrailNote.deleteMany({});
    await AuditLog.create({ action: 'DELETE', entity: 'Trail', details: 'Deleted all trail entries' });
    success(res, { message: 'All trail entries deleted' });
  } catch (err) { next(err); }
});

export default router;
