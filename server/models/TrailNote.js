import mongoose from 'mongoose';

const trailNoteSchema = new mongoose.Schema({
  trailId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trail', required: true },
  content: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('TrailNote', trailNoteSchema);
