import mongoose from 'mongoose';

const reminderNoteSchema = new mongoose.Schema({
  reminderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reminder', required: true },
  content: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('ReminderNote', reminderNoteSchema);
