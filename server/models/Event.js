import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: Date, default: Date.now },
  time: { type: String, default: '' }, // HH:MM format
  notes: { type: String, default: '' }, // rich text HTML
  reminderEnabled: { type: Boolean, default: false },
  reminderMonth: { type: Number }, // 1-12
  reminderDay: { type: Number }, // 1-31
  lastReminderNotifiedKey: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Event', eventSchema);
