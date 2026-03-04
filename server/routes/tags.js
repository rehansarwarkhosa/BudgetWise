import { Router } from 'express';
import Tag from '../models/Tag.js';
import Note from '../models/Note.js';
import { success, error } from '../utils/response.js';

const router = Router();

// Get all tags
router.get('/', async (req, res, next) => {
  try {
    const tags = await Tag.find().sort({ name: 1 });
    success(res, tags);
  } catch (err) { next(err); }
});

// Create tag
router.post('/', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name) return error(res, 'Name is required');
    const tag = await Tag.create({ name, color });
    success(res, tag, 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Tag already exists');
    next(err);
  }
});

// Update tag
router.put('/:id', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const tag = await Tag.findById(req.params.id);
    if (!tag) return error(res, 'Tag not found', 404);
    if (name) tag.name = name;
    if (color) tag.color = color;
    await tag.save();
    success(res, tag);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Tag already exists');
    next(err);
  }
});

// Delete tag — also pull from all notes
router.delete('/:id', async (req, res, next) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) return error(res, 'Tag not found', 404);
    await Note.updateMany({ tags: tag._id }, { $pull: { tags: tag._id } });
    success(res, { message: 'Tag deleted' });
  } catch (err) { next(err); }
});

export default router;
