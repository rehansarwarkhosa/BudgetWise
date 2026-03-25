import mongoose from 'mongoose';

const aiResponseSchema = new mongoose.Schema({
  source: { type: String, enum: ['budget', 'routines', 'notes'], required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  query: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('AiResponse', aiResponseSchema);
