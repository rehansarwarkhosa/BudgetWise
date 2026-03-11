import mongoose from 'mongoose';

const stockNoteSchema = new mongoose.Schema({
  stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem', required: true },
  content: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('StockNote', stockNoteSchema);
