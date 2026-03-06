import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  color: { type: String, default: '#6C63FF' },
}, { timestamps: true });

export default mongoose.model('Topic', topicSchema);
