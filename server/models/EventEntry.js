import mongoose from 'mongoose';

const eventEntrySchema = new mongoose.Schema({
  containerId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventContainer', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, default: '', trim: true }, // e.g. 'Given', 'Received' — empty if transaction type disabled
  amount: { type: Number, default: 0 }, // used for currency and time log types
  textValue: { type: String, default: '', trim: true }, // used for 'other' log type
}, { timestamps: true });

export default mongoose.model('EventEntry', eventEntrySchema);
