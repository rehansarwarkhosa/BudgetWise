import { Router } from 'express';
import Topic from '../models/Topic.js';
import SubTopic from '../models/SubTopic.js';
import Note from '../models/Note.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// ─── Topics ───

router.get('/topics', async (req, res, next) => {
  try {
    const topics = await Topic.find().sort({ createdAt: -1 });
    const result = await Promise.all(topics.map(async (t) => {
      const subCount = await SubTopic.countDocuments({ topicId: t._id });
      const subs = await SubTopic.find({ topicId: t._id });
      const noteCount = await Note.countDocuments({ subTopicId: { $in: subs.map(s => s._id) } });
      return { ...t.toObject(), subCount, noteCount };
    }));
    success(res, result);
  } catch (err) { next(err); }
});

router.post('/topics', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return error(res, 'Name is required');
    const topic = await Topic.create({ name });
    await AuditLog.create({ action: 'CREATE', entity: 'Topic', entityId: topic._id, details: `Created topic "${name}"` });
    success(res, topic, 201);
  } catch (err) { next(err); }
});

router.put('/topics/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const topic = await Topic.findById(req.params.id);
    if (!topic) return error(res, 'Topic not found', 404);
    const oldName = topic.name;
    if (name) topic.name = name;
    await topic.save();
    if (name && name !== oldName) await AuditLog.create({ action: 'UPDATE', entity: 'Topic', entityId: topic._id, details: `Renamed topic "${oldName}" -> "${name}"` });
    success(res, topic);
  } catch (err) { next(err); }
});

router.delete('/topics/:id', async (req, res, next) => {
  try {
    const topic = await Topic.findByIdAndDelete(req.params.id);
    if (!topic) return error(res, 'Topic not found', 404);
    const subs = await SubTopic.find({ topicId: topic._id });
    const subIds = subs.map(s => s._id);
    await Note.deleteMany({ subTopicId: { $in: subIds } });
    await SubTopic.deleteMany({ topicId: topic._id });
    await AuditLog.create({ action: 'DELETE', entity: 'Topic', entityId: topic._id, details: `Deleted topic "${topic.name}" and all subtopics/notes` });
    success(res, { message: 'Topic and all contents deleted' });
  } catch (err) { next(err); }
});

// ─── SubTopics ───

router.get('/topics/:topicId/subtopics', async (req, res, next) => {
  try {
    const subs = await SubTopic.find({ topicId: req.params.topicId }).sort({ createdAt: -1 });
    const result = await Promise.all(subs.map(async (s) => {
      const noteCount = await Note.countDocuments({ subTopicId: s._id });
      return { ...s.toObject(), noteCount };
    }));
    success(res, result);
  } catch (err) { next(err); }
});

router.post('/topics/:topicId/subtopics', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return error(res, 'Name is required');
    const topic = await Topic.findById(req.params.topicId);
    if (!topic) return error(res, 'Topic not found', 404);
    const sub = await SubTopic.create({ topicId: req.params.topicId, name });
    await AuditLog.create({ action: 'CREATE', entity: 'SubTopic', entityId: sub._id, details: `Created subtopic "${name}" in "${topic.name}"` });
    success(res, sub, 201);
  } catch (err) { next(err); }
});

router.put('/subtopics/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const sub = await SubTopic.findById(req.params.id);
    if (!sub) return error(res, 'SubTopic not found', 404);
    const oldName = sub.name;
    if (name) sub.name = name;
    await sub.save();
    if (name && name !== oldName) await AuditLog.create({ action: 'UPDATE', entity: 'SubTopic', entityId: sub._id, details: `Renamed subtopic "${oldName}" -> "${name}"` });
    success(res, sub);
  } catch (err) { next(err); }
});

router.delete('/subtopics/:id', async (req, res, next) => {
  try {
    const sub = await SubTopic.findByIdAndDelete(req.params.id);
    if (!sub) return error(res, 'SubTopic not found', 404);
    await Note.deleteMany({ subTopicId: sub._id });
    await AuditLog.create({ action: 'DELETE', entity: 'SubTopic', entityId: sub._id, details: `Deleted subtopic "${sub.name}" and all notes` });
    success(res, { message: 'SubTopic and notes deleted' });
  } catch (err) { next(err); }
});

// ─── Notes ───

router.get('/subtopics/:subTopicId/notes', async (req, res, next) => {
  try {
    const notes = await Note.find({ subTopicId: req.params.subTopicId })
      .populate('tags')
      .sort({ createdAt: -1 });
    success(res, notes);
  } catch (err) { next(err); }
});

router.post('/subtopics/:subTopicId/notes', async (req, res, next) => {
  try {
    const { title, description, tags } = req.body;
    if (!title) return error(res, 'Title is required');
    const sub = await SubTopic.findById(req.params.subTopicId);
    if (!sub) return error(res, 'SubTopic not found', 404);
    const note = await Note.create({
      subTopicId: req.params.subTopicId,
      title,
      description: description || '',
      tags: tags || [],
    });
    const populated = await note.populate('tags');
    await AuditLog.create({ action: 'CREATE', entity: 'Note', entityId: note._id, details: `Created note "${title}"` });
    success(res, populated, 201);
  } catch (err) { next(err); }
});

router.get('/note/:id', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).populate('tags');
    if (!note) return error(res, 'Note not found', 404);
    success(res, note);
  } catch (err) { next(err); }
});

router.put('/note/:id', async (req, res, next) => {
  try {
    const { title, description, tags } = req.body;
    const note = await Note.findById(req.params.id);
    if (!note) return error(res, 'Note not found', 404);
    if (title !== undefined) note.title = title;
    if (description !== undefined) note.description = description;
    if (tags !== undefined) note.tags = tags;
    await note.save();
    const populated = await note.populate('tags');
    await AuditLog.create({ action: 'UPDATE', entity: 'Note', entityId: note._id, details: `Updated note "${note.title}"` });
    success(res, populated);
  } catch (err) { next(err); }
});

router.delete('/note/:id', async (req, res, next) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) return error(res, 'Note not found', 404);
    await AuditLog.create({ action: 'DELETE', entity: 'Note', entityId: note._id, details: `Deleted note "${note.title}"` });
    success(res, { message: 'Note deleted' });
  } catch (err) { next(err); }
});

// ─── Recent Notes ───

router.get('/recent', async (req, res, next) => {
  try {
    const notes = await Note.find()
      .populate('tags')
      .populate({
        path: 'subTopicId',
        populate: { path: 'topicId' },
      })
      .sort({ updatedAt: -1 })
      .limit(10);
    success(res, notes);
  } catch (err) { next(err); }
});

// ─── Tree (all topics with subtopics and note counts) ───

router.get('/tree', async (req, res, next) => {
  try {
    const topics = await Topic.find().sort({ name: 1 });
    const tree = await Promise.all(topics.map(async (t) => {
      const subs = await SubTopic.find({ topicId: t._id }).sort({ name: 1 });
      const subsWithNotes = await Promise.all(subs.map(async (s) => {
        const notes = await Note.find({ subTopicId: s._id })
          .populate('tags')
          .sort({ updatedAt: -1 });
        return { ...s.toObject(), notes };
      }));
      return { ...t.toObject(), subTopics: subsWithNotes };
    }));
    success(res, tree);
  } catch (err) { next(err); }
});

// ─── Search ───

router.get('/search', async (req, res, next) => {
  try {
    const { q, tag } = req.query;
    const filter = {};
    if (q) filter.$text = { $search: q };
    if (tag) filter.tags = tag;

    const notes = await Note.find(filter)
      .populate('tags')
      .populate({
        path: 'subTopicId',
        populate: { path: 'topicId' },
      })
      .sort({ createdAt: -1 });
    success(res, notes);
  } catch (err) { next(err); }
});

export default router;
