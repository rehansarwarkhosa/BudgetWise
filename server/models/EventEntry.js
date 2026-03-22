import mongoose from 'mongoose';

const eventEntrySchema = new mongoose.Schema({
  containerId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventContainer', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true }, // e.g. 'Given', 'Received'
  amount: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export default mongoose.model('EventEntry', eventEntrySchema);
