import mongoose from 'mongoose';

const stockLogSchema = new mongoose.Schema({
  type: { type: String, enum: ['consume', 'refill'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  date: { type: Date, default: Date.now },
  note: { type: String, default: '' },
}, { _id: true, timestamps: false });

const stockItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  unit: { type: String, default: 'unit' }, // e.g. tablet, strip, box, pack, piece, kg, liter
  currentStock: { type: Number, default: 0, min: 0 },
  minStock: { type: Number, default: 0, min: 0 }, // alert threshold
  logs: [stockLogSchema],
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('StockItem', stockItemSchema);
