import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  mode: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  negativeLimit: { type: Number, default: 0 },
  currentPeriod: {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
  },
  notificationEmail: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
