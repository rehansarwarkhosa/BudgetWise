import { Router } from 'express';
import Event from '../models/Event.js';
import EventFolder from '../models/EventFolder.js';
import EventContainer from '../models/EventContainer.js';
import EventEntry from '../models/EventEntry.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// ─── Folders ───

// Get all folders (with event count)
router.get('/folders', async (req, res, next) => {
  try {
    const folders = await EventFolder.find().sort({ createdAt: -1 });
    const result = await Promise.all(folders.map(async (f) => {
      const eventCount = await Event.countDocuments({ folderId: f._id });
      return { ...f.toObject(), eventCount };
    }));
    success(res, result);
  } catch (err) { next(err); }
});

// Create folder
router.post('/folders', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return error(res, 'Folder name is required');
    const folder = await EventFolder.create({ name: name.trim(), description: (description || '').trim() });
    await AuditLog.create({ action: 'CREATE', entity: 'EventFolder', entityId: folder._id, details: `Created event folder "${name.trim()}"` });
    success(res, folder, 201);
  } catch (err) { next(err); }
});

// Update folder
router.put('/folders/:id', async (req, res, next) => {
  try {
    const folder = await EventFolder.findById(req.params.id);
    if (!folder) return error(res, 'Folder not found', 404);
    const { name, description } = req.body;
    const changes = [];
    if (name !== undefined && name !== folder.name) { changes.push(`name: "${folder.name}" -> "${name}"`); folder.name = name; }
    if (description !== undefined && description !== folder.description) { changes.push('description updated'); folder.description = description; }
    await folder.save();
    if (changes.length) await AuditLog.create({ action: 'UPDATE', entity: 'EventFolder', entityId: folder._id, details: `Updated folder "${folder.name}": ${changes.join(', ')}` });
    success(res, folder);
  } catch (err) { next(err); }
});

// Delete folder (and all events, containers, entries inside)
router.delete('/folders/:id', async (req, res, next) => {
  try {
    const folder = await EventFolder.findById(req.params.id);
    if (!folder) return error(res, 'Folder not found', 404);
    const events = await Event.find({ folderId: folder._id });
    for (const evt of events) {
      const containers = await EventContainer.find({ eventId: evt._id });
      const containerIds = containers.map(c => c._id);
      await EventEntry.deleteMany({ containerId: { $in: containerIds } });
      await EventContainer.deleteMany({ eventId: evt._id });
    }
    await Event.deleteMany({ folderId: folder._id });
    await EventFolder.findByIdAndDelete(req.params.id);
    await AuditLog.create({ action: 'DELETE', entity: 'EventFolder', entityId: folder._id, details: `Deleted folder "${folder.name}" and all its events/containers/entries` });
    success(res, { message: 'Folder deleted' });
  } catch (err) { next(err); }
});

// ─── Events ───

// Get events (optionally filtered by folderId)
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.folderId) filter.folderId = req.query.folderId;
    const events = await Event.find(filter).sort({ createdAt: -1 });
    success(res, events);
  } catch (err) { next(err); }
});

// Create event
router.post('/', async (req, res, next) => {
  try {
    const { name, date, time, notes, reminderEnabled, folderId } = req.body;
    if (!name?.trim()) return error(res, 'Event name is required');

    const eventData = { name: name.trim(), notes: notes || '' };
    if (folderId) eventData.folderId = folderId;
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
        if (c.logType === 'other') return; // no numeric summary for 'other' type
        const key = e.type || '_total';
        if (!summary[key]) summary[key] = 0;
        summary[key] += e.amount;
      });
      return { ...c.toObject(), entryCount: entries.length, summary };
    }));
    success(res, result);
  } catch (err) { next(err); }
});

// Create container
router.post('/:eventId/containers', async (req, res, next) => {
  try {
    const { name, date, time, logType, currency, showTransactionType, defaultTransactionType } = req.body;
    if (!name?.trim()) return error(res, 'Container name is required');
    const event = await Event.findById(req.params.eventId);
    if (!event) return error(res, 'Event not found', 404);

    const containerData = { eventId: req.params.eventId, name: name.trim() };
    if (date) containerData.date = date;
    if (time) containerData.time = time;
    if (logType) containerData.logType = logType;
    if (currency) containerData.currency = currency;
    if (showTransactionType !== undefined) containerData.showTransactionType = showTransactionType;
    if (defaultTransactionType !== undefined) containerData.defaultTransactionType = defaultTransactionType;
    const container = await EventContainer.create(containerData);
    await AuditLog.create({ action: 'CREATE', entity: 'EventContainer', entityId: container._id, details: `Created container "${name.trim()}" in event "${event.name}"` });
    success(res, container, 201);
  } catch (err) { next(err); }
});

// Update container
router.put('/containers/:id', async (req, res, next) => {
  try {
    const container = await EventContainer.findById(req.params.id);
    if (!container) return error(res, 'Container not found', 404);
    const { name, logType, currency, showTransactionType, defaultTransactionType } = req.body;
    const changes = [];
    if (name && name !== container.name) { changes.push(`name: "${container.name}" -> "${name}"`); container.name = name; }
    if (logType !== undefined && logType !== container.logType) { changes.push(`logType: "${container.logType}" -> "${logType}"`); container.logType = logType; }
    if (currency !== undefined && currency !== container.currency) { changes.push(`currency: "${container.currency}" -> "${currency}"`); container.currency = currency; }
    if (showTransactionType !== undefined && showTransactionType !== container.showTransactionType) { container.showTransactionType = showTransactionType; changes.push(`showTransactionType: ${showTransactionType}`); }
    if (defaultTransactionType !== undefined && defaultTransactionType !== container.defaultTransactionType) { container.defaultTransactionType = defaultTransactionType; changes.push(`defaultTransactionType: "${defaultTransactionType}"`); }
    await container.save();
    if (changes.length) await AuditLog.create({ action: 'UPDATE', entity: 'EventContainer', entityId: container._id, details: `Updated container: ${changes.join(', ')}` });
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
    const { name, type, amount, textValue } = req.body;
    if (!name?.trim()) return error(res, 'Name is required');

    const container = await EventContainer.findById(req.params.containerId);
    if (!container) return error(res, 'Container not found', 404);

    const entryData = { containerId: req.params.containerId, name: name.trim() };
    if (type) entryData.type = type.trim();
    if (amount !== undefined && amount !== null && amount !== '') entryData.amount = Number(amount);
    if (textValue !== undefined) entryData.textValue = textValue;

    const entry = await EventEntry.create(entryData);
    const detail = container.logType === 'other' ? `"${textValue || ''}"` : `${amount || 0}`;
    await AuditLog.create({ action: 'CREATE', entity: 'EventEntry', entityId: entry._id, details: `Entry in "${container.name}": ${name.trim()} ${type || ''} ${detail}` });
    success(res, entry, 201);
  } catch (err) { next(err); }
});

// Update entry
router.put('/entries/:id', async (req, res, next) => {
  try {
    const entry = await EventEntry.findById(req.params.id);
    if (!entry) return error(res, 'Entry not found', 404);
    const { name, type, amount, textValue } = req.body;
    const changes = [];
    if (name !== undefined && name !== entry.name) { changes.push(`name: "${entry.name}" -> "${name}"`); entry.name = name; }
    if (type !== undefined && type !== entry.type) { changes.push(`type: "${entry.type}" -> "${type}"`); entry.type = type; }
    if (amount !== undefined && amount !== entry.amount) { changes.push(`amount: ${entry.amount} -> ${amount}`); entry.amount = amount; }
    if (textValue !== undefined && textValue !== entry.textValue) { changes.push(`textValue: "${entry.textValue}" -> "${textValue}"`); entry.textValue = textValue; }
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
