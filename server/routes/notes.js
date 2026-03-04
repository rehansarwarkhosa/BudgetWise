import { Router } from 'express';
import Topic from '../models/Topic.js';
import SubTopic from '../models/SubTopic.js';
import Note from '../models/Note.js';
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
    success(res, topic, 201);
  } catch (err) { next(err); }
});

router.put('/topics/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const topic = await Topic.findById(req.params.id);
    if (!topic) return error(res, 'Topic not found', 404);
    if (name) topic.name = name;
    await topic.save();
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
    success(res, sub, 201);
  } catch (err) { next(err); }
});

router.put('/subtopics/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const sub = await SubTopic.findById(req.params.id);
    if (!sub) return error(res, 'SubTopic not found', 404);
    if (name) sub.name = name;
    await sub.save();
    success(res, sub);
  } catch (err) { next(err); }
});

router.delete('/subtopics/:id', async (req, res, next) => {
  try {
    const sub = await SubTopic.findByIdAndDelete(req.params.id);
    if (!sub) return error(res, 'SubTopic not found', 404);
    await Note.deleteMany({ subTopicId: sub._id });
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
    success(res, populated);
  } catch (err) { next(err); }
});

router.delete('/note/:id', async (req, res, next) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) return error(res, 'Note not found', 404);
    success(res, { message: 'Note deleted' });
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
