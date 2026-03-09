import mongoose from 'mongoose';

const workOrderNoteSchema = new mongoose.Schema({
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
  content: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('WorkOrderNote', workOrderNoteSchema);
