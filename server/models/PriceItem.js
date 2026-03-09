import mongoose from 'mongoose';

const priceItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, default: 'General' },
}, { timestamps: true });

priceItemSchema.index({ name: 'text' });

export default mongoose.model('PriceItem', priceItemSchema);
