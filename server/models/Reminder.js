import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['once', 'daily', 'weekdays', 'custom_days', 'custom_dates', 'interval'],
    required: true,
  },
  time: { type: String, required: true }, // HH:MM
  days: [Number], // 0-6 for custom_days
  dates: [Date], // for custom_dates
  intervalDays: { type: Number }, // for interval type
  intervalStartDate: { type: Date },
  enabled: { type: Boolean, default: true },
  fired: { type: Boolean, default: false }, // for 'once' type
  lastNotifiedDate: { type: String, default: '' },
});

const reminderSchema = new mongoose.Schema({
  title: { type: String, required: true },
  note: { type: String, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  schedule: { type: scheduleSchema, required: true },
  status: { type: String, enum: ['active', 'snoozed', 'completed', 'expired', 'archived'], default: 'active' },
  locked: { type: Boolean, default: false },
  snoozeUntil: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

reminderSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export default mongoose.model('Reminder', reminderSchema);
