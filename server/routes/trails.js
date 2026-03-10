import { Router } from 'express';
import Trail from '../models/Trail.js';
import TrailNote from '../models/TrailNote.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// GET / — paginated, newest first, optional search + filter
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();
    const filter = req.query.filter || 'all'; // 'all', 'with_reminders', 'plain'

    const query = {};
    if (search) query.text = { $regex: search, $options: 'i' };
    if (filter === 'with_reminders') query['reminders.0'] = { $exists: true };
    else if (filter === 'plain') query['reminders.0'] = { $exists: false };

    const [entries, total] = await Promise.all([
      Trail.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Trail.countDocuments(query),
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
    if (req.body.reminders !== undefined) { trail.reminders = req.body.reminders; changes.push(`reminders updated (${req.body.reminders.length})`); }
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
