import mongoose from 'mongoose';

const eventFolderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
}, { timestamps: true });

export default mongoose.model('EventFolder', eventFolderSchema);
