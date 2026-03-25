import { Router } from 'express';
import AiResponse from '../models/AiResponse.js';
import { success, error } from '../utils/response.js';

const router = Router();

// Get all AI responses (latest first)
router.get('/', async (req, res, next) => {
  try {
    const responses = await AiResponse.find().sort({ createdAt: -1 });
    success(res, responses);
  } catch (err) { next(err); }
});

// Delete one
router.delete('/:id', async (req, res, next) => {
  try {
    await AiResponse.findByIdAndDelete(req.params.id);
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

// Delete all
router.delete('/', async (req, res, next) => {
  try {
    await AiResponse.deleteMany({});
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
