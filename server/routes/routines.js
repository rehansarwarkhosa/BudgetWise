import { Router } from 'express';
import Routine from '../models/Routine.js';
import RoutineEntry from '../models/RoutineEntry.js';
import { success, error } from '../utils/response.js';

const router = Router();

// Get all routines
router.get('/', async (req, res, next) => {
  try {
    const routines = await Routine.find().sort({ createdAt: -1 });
    const routinesWithCounts = await Promise.all(
      routines.map(async (r) => {
        const entryCount = await RoutineEntry.countDocuments({ routineId: r._id });
        const lastEntry = await RoutineEntry.findOne({ routineId: r._id }).sort({ date: -1 });
        return { ...r.toObject(), entryCount, lastEntry };
      })
    );
    success(res, routinesWithCounts);
  } catch (err) { next(err); }
});

// Get single routine
router.get('/:id', async (req, res, next) => {
  try {
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    success(res, routine);
  } catch (err) { next(err); }
});

// Create routine
router.post('/', async (req, res, next) => {
  try {
    const { name, dueDate, fields } = req.body;
    if (!name) return error(res, 'Name is required');
    const routine = await Routine.create({ name, dueDate: dueDate || null, fields: fields || [] });
    success(res, routine, 201);
  } catch (err) { next(err); }
});

// Update routine
router.put('/:id', async (req, res, next) => {
  try {
    const { name, dueDate, fields } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    if (name) routine.name = name;
    if (dueDate !== undefined) routine.dueDate = dueDate;
    if (fields) routine.fields = fields;
    await routine.save();
    success(res, routine);
  } catch (err) { next(err); }
});

// Delete routine and its entries
router.delete('/:id', async (req, res, next) => {
  try {
    const routine = await Routine.findByIdAndDelete(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);
    await RoutineEntry.deleteMany({ routineId: routine._id });
    success(res, { message: 'Routine and entries deleted' });
  } catch (err) { next(err); }
});

// --- Routine Entries ---

// Get entries for a routine
router.get('/:id/entries', async (req, res, next) => {
  try {
    const entries = await RoutineEntry.find({ routineId: req.params.id }).sort({ date: -1 });
    success(res, entries);
  } catch (err) { next(err); }
});

// Log entry
router.post('/:id/entries', async (req, res, next) => {
  try {
    const { status, fieldValues, manualDate, date } = req.body;
    const routine = await Routine.findById(req.params.id);
    if (!routine) return error(res, 'Routine not found', 404);

    const entryDate = manualDate && date ? new Date(date) : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));

    const entry = await RoutineEntry.create({
      routineId: req.params.id,
      status: status || 'complete',
      date: entryDate,
      fieldValues: fieldValues || [],
      manualDate: !!manualDate,
    });

    success(res, entry, 201);
  } catch (err) { next(err); }
});

// Delete entry
router.delete('/entries/:entryId', async (req, res, next) => {
  try {
    const entry = await RoutineEntry.findByIdAndDelete(req.params.entryId);
    if (!entry) return error(res, 'Entry not found', 404);
    success(res, { message: 'Entry deleted' });
  } catch (err) { next(err); }
});

export default router;
