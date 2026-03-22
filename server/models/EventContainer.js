import mongoose from 'mongoose';

const eventContainerSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

export default mongoose.model('EventContainer', eventContainerSchema);
