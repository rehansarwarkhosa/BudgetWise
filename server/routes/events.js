import { Router } from 'express';
import Event from '../models/Event.js';
import EventContainer from '../models/EventContainer.js';
import EventEntry from '../models/EventEntry.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// ─── Events ───

// Get all events
router.get('/', async (req, res, next) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    success(res, events);
  } catch (err) { next(err); }
});

// Create event
router.post('/', async (req, res, next) => {
  try {
    const { name, date, time, notes, reminderEnabled } = req.body;
    if (!name?.trim()) return error(res, 'Event name is required');

    const eventData = { name: name.trim(), notes: notes || '' };
    if (date) eventData.date = date;
    if (time) eventData.time = time;

    if (reminderEnabled) {
      eventData.reminderEnabled = true;
      const d = new Date(date || Date.now());
      eventData.reminderMonth = d.getMonth() + 1;
      eventData.reminderDay = d.getDate();
    }

    const event = await Event.create(eventData);
    await AuditLog.create({ action: 'CREATE', entity: 'Event', entityId: event._id, details: `Created event "${name.trim()}"` });
    success(res, event, 201);
  } catch (err) { next(err); }
});

// Update event
router.put('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return error(res, 'Event not found', 404);

    const { name, date, time, notes, reminderEnabled } = req.body;
    const changes = [];

    if (name !== undefined && name !== event.name) { changes.push(`name: "${event.name}" -> "${name}"`); event.name = name; }
    if (date !== undefined) { event.date = date; changes.push('date updated'); }
    if (time !== undefined && time !== event.time) { changes.push(`time: "${event.time}" -> "${time}"`); event.time = time; }
    if (notes !== undefined) { event.notes = notes; changes.push('notes updated'); }
    if (reminderEnabled !== undefined && reminderEnabled !== event.reminderEnabled) {
      changes.push(`reminder: ${event.reminderEnabled} -> ${reminderEnabled}`);
      event.reminderEnabled = reminderEnabled;
      if (reminderEnabled) {
        const d = new Date(date || event.date || Date.now());
        event.reminderMonth = d.getMonth() + 1;
        event.reminderDay = d.getDate();
      }
    }

    await event.save();
    if (changes.length) await AuditLog.create({ action: 'UPDATE', entity: 'Event', entityId: event._id, details: `Updated event "${event.name}": ${changes.join(', ')}` });
    success(res, event);
  } catch (err) { next(err); }
});

// Delete event (and all containers + entries)
router.delete('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return error(res, 'Event not found', 404);

    const containers = await EventContainer.find({ eventId: event._id });
    const containerIds = containers.map(c => c._id);
    await EventEntry.deleteMany({ containerId: { $in: containerIds } });
    await EventContainer.deleteMany({ eventId: event._id });
    await Event.findByIdAndDelete(req.params.id);

    await AuditLog.create({ action: 'DELETE', entity: 'Event', entityId: event._id, details: `Deleted event "${event.name}" and all containers/entries` });
    success(res, { message: 'Event deleted' });
  } catch (err) { next(err); }
});

// ─── Containers ───

// Get containers for an event (latest first)
router.get('/:eventId/containers', async (req, res, next) => {
  try {
    const containers = await EventContainer.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
    // Include entry counts and totals
    const result = await Promise.all(containers.map(async (c) => {
      const entries = await EventEntry.find({ containerId: c._id });
      const summary = {};
      entries.forEach(e => {
        if (!summary[e.type]) summary[e.type] = 0;
        summary[e.type] += e.amount;
      });
      return { ...c.toObject(), entryCount: entries.length, summary };
    }));
    success(res, result);
  } catch (err) { next(err); }
});

// Create container
router.post('/:eventId/containers', async (req, res, next) => {
  try {
    const { name, date, time } = req.body;
    if (!name?.trim()) return error(res, 'Container name is required');
    const event = await Event.findById(req.params.eventId);
    if (!event) return error(res, 'Event not found', 404);

    const containerData = { eventId: req.params.eventId, name: name.trim() };
    if (date) containerData.date = date;
    if (time) containerData.time = time;
    const container = await EventContainer.create(containerData);
    await AuditLog.create({ action: 'CREATE', entity: 'EventContainer', entityId: container._id, details: `Created container "${name.trim()}" in event "${event.name}"` });
    success(res, container, 201);
  } catch (err) { next(err); }
});

// Rename container
router.put('/containers/:id', async (req, res, next) => {
  try {
    const container = await EventContainer.findById(req.params.id);
    if (!container) return error(res, 'Container not found', 404);
    const { name } = req.body;
    const oldName = container.name;
    if (name) container.name = name;
    await container.save();
    if (name && name !== oldName) await AuditLog.create({ action: 'UPDATE', entity: 'EventContainer', entityId: container._id, details: `Renamed container "${oldName}" -> "${name}"` });
    success(res, container);
  } catch (err) { next(err); }
});

// Delete container (and all entries)
router.delete('/containers/:id', async (req, res, next) => {
  try {
    const container = await EventContainer.findById(req.params.id);
    if (!container) return error(res, 'Container not found', 404);
    await EventEntry.deleteMany({ containerId: container._id });
    await EventContainer.findByIdAndDelete(req.params.id);
    await AuditLog.create({ action: 'DELETE', entity: 'EventContainer', entityId: container._id, details: `Deleted container "${container.name}" and all entries` });
    success(res, { message: 'Container deleted' });
  } catch (err) { next(err); }
});

// ─── Entries ───

// Get entries for a container
router.get('/containers/:containerId/entries', async (req, res, next) => {
  try {
    const entries = await EventEntry.find({ containerId: req.params.containerId }).sort({ createdAt: -1 });
    success(res, entries);
  } catch (err) { next(err); }
});

// Create entry
router.post('/containers/:containerId/entries', async (req, res, next) => {
  try {
    const { name, type, amount } = req.body;
    if (!name?.trim()) return error(res, 'Name is required');
    if (!type?.trim()) return error(res, 'Type is required');
    if (amount === undefined || amount === null) return error(res, 'Amount is required');

    const container = await EventContainer.findById(req.params.containerId);
    if (!container) return error(res, 'Container not found', 404);

    const entry = await EventEntry.create({ containerId: req.params.containerId, name: name.trim(), type: type.trim(), amount: Number(amount) });
    await AuditLog.create({ action: 'CREATE', entity: 'EventEntry', entityId: entry._id, details: `Entry in "${container.name}": ${name.trim()} ${type.trim()} ${amount} PKR` });
    success(res, entry, 201);
  } catch (err) { next(err); }
});

// Update entry
router.put('/entries/:id', async (req, res, next) => {
  try {
    const entry = await EventEntry.findById(req.params.id);
    if (!entry) return error(res, 'Entry not found', 404);
    const { name, type, amount } = req.body;
    const changes = [];
    if (name !== undefined && name !== entry.name) { changes.push(`name: "${entry.name}" -> "${name}"`); entry.name = name; }
    if (type !== undefined && type !== entry.type) { changes.push(`type: "${entry.type}" -> "${type}"`); entry.type = type; }
    if (amount !== undefined && amount !== entry.amount) { changes.push(`amount: ${entry.amount} -> ${amount}`); entry.amount = amount; }
    await entry.save();
    if (changes.length) await AuditLog.create({ action: 'UPDATE', entity: 'EventEntry', entityId: entry._id, details: `Updated entry: ${changes.join(', ')}` });
    success(res, entry);
  } catch (err) { next(err); }
});

// Delete entry
router.delete('/entries/:id', async (req, res, next) => {
  try {
    const entry = await EventEntry.findById(req.params.id);
    if (!entry) return error(res, 'Entry not found', 404);
    await EventEntry.findByIdAndDelete(req.params.id);
    await AuditLog.create({ action: 'DELETE', entity: 'EventEntry', entityId: entry._id, details: `Deleted entry "${entry.name}" (${entry.type} ${entry.amount} PKR)` });
    success(res, { message: 'Entry deleted' });
  } catch (err) { next(err); }
});

export default router;
