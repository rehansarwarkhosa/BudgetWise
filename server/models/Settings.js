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
  routineHighlights: [{
    keyword: { type: String, required: true },
    color: { type: String, required: true },
  }],
  kanbanDueDateColors: {
    rules: [{
      days: { type: Number, required: true },
      color: { type: String, required: true },
      label: { type: String, default: '' },
    }],
    overdueColor: { type: String, default: '#dc2626' },
  },
  menuSwipeEnabled: { type: Boolean, default: true },
  tabSwipeTrail: { type: Boolean, default: true },
  tabSwipeBudget: { type: Boolean, default: true },
  tabSwipeRoutines: { type: Boolean, default: true },
  tabSwipeNotes: { type: Boolean, default: true },
  trailReorderEnabled: { type: Boolean, default: true },
  trailReorderTaps: { type: Number, default: 2, min: 2, max: 5 },
  trailDetailEnabled: { type: Boolean, default: true },
  trailDetailTaps: { type: Number, default: 3, min: 2, max: 5 },
  budgetLocked: { type: Boolean, default: false },
  settingsLocked: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
