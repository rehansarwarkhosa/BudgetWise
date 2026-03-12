import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  type: { type: String, enum: ['once', 'daily', 'weekdays', 'custom_days', 'custom_dates'], required: true },
  time: { type: String, required: true },
  days: [Number],
  dates: [Date],
  enabled: { type: Boolean, default: true },
  fired: { type: Boolean, default: false },
  lastNotifiedDate: { type: String, default: '' },
});

const workOrderSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['todo', 'doing', 'done', 'archived'], default: 'todo' },
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', default: null },
  budgetAmount: { type: Number, default: 0 },
  budgetExpenseStatus: { type: String, enum: ['none', 'pending', 'completed', 'failed'], default: 'none' },
  dueDate: { type: Date, default: null },
  reminders: [reminderSchema],
}, { timestamps: true });

export default mongoose.model('WorkOrder', workOrderSchema);
