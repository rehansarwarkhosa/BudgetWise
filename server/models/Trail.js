import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  type: { type: String, enum: ['daily', 'weekdays', 'custom_days', 'custom_dates', 'once'], required: true },
  time: { type: String, required: true },
  days: [Number],
  dates: [Date],
  enabled: { type: Boolean, default: true },
  lastNotifiedDate: { type: String, default: '' },
  fired: { type: Boolean, default: false },
});

const trailSchema = new mongoose.Schema({
  text: { type: String, required: true },
  reminders: [reminderSchema],
  highlighted: { type: Boolean, default: false },
  quickPhrase: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  adjustedAt: { type: Date, default: null },
  linkedWorkOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Trail', trailSchema);
