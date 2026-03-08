import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'textarea', 'number', 'date', 'time', 'rating', 'radio', 'checkbox'], required: true },
  options: [{ type: String }],
}, { _id: true });

const reminderSchema = new mongoose.Schema({
  type: { type: String, enum: ['daily', 'weekdays', 'custom_days', 'custom_dates'], required: true },
  time: { type: String, required: true },
  days: [{ type: Number }],
  dates: [{ type: Date }],
  enabled: { type: Boolean, default: true },
  lastNotifiedDate: { type: String, default: '' },
}, { _id: true });

const routineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dueDate: { type: Date, required: true },
  targetEntries: { type: Number, required: true, min: 1 },
  maxDailyEntries: { type: Number, default: 1, min: 1 },
  fields: [fieldSchema],
  reminders: [reminderSchema],
}, { timestamps: true });

export default mongoose.model('Routine', routineSchema);
