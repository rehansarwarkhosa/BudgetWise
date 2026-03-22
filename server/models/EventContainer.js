import mongoose from 'mongoose';

const eventContainerSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true, trim: true },
  date: { type: Date, default: Date.now },
  time: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('EventContainer', eventContainerSchema);
