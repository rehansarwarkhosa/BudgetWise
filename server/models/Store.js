import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
}, { timestamps: true });

storeSchema.index({ name: 'text' });

export default mongoose.model('Store', storeSchema);
