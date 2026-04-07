import mongoose from 'mongoose';

const eventContainerSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true, trim: true },
  date: { type: Date, default: Date.now },
  time: { type: String, default: '' },
  logType: { type: String, enum: ['currency', 'time', 'other'], default: 'currency' },
  currency: { type: String, default: 'PKR', trim: true },
  showTransactionType: { type: Boolean, default: true },
  defaultTransactionType: { type: String, default: '', trim: true },
}, { timestamps: true });

export default mongoose.model('EventContainer', eventContainerSchema);
