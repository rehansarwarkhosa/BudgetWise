import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  subTopicId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubTopic', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  locked: { type: Boolean, default: false },
}, { timestamps: true });

noteSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Note', noteSchema);
