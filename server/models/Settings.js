import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  mode: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  negativeLimit: { type: Number, default: 0 },
  currentPeriod: {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
  },
  notificationEmail: { type: String, default: '' },
  emailNotificationsEnabled: { type: Boolean, default: true },
  theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
  trailBoldText: { type: Boolean, default: false },
  trailHighlights: [{
    keyword: { type: String, required: true },
    color: { type: String, required: true },
  }],
  kanbanDueDateColors: {
    warningDays: { type: Number, default: 3 },
    warningColor: { type: String, default: '#f59e0b' },
    dangerDays: { type: Number, default: 1 },
    dangerColor: { type: String, default: '#ef4444' },
    overdueColor: { type: String, default: '#dc2626' },
  },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
