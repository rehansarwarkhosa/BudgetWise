import mongoose from 'mongoose';

const priceEntrySchema = new mongoose.Schema({
  priceItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceItem', required: true },
  amount: { type: Number, required: true },
  store: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('PriceEntry', priceEntrySchema);
