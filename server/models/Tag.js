import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  color: { type: String, default: '#6C63FF' },
}, { timestamps: true });

export default mongoose.model('Tag', tagSchema);
