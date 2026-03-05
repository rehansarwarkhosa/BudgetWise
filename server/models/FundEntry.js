import mongoose from 'mongoose';

const fundEntrySchema = new mongoose.Schema({
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', required: true },
  amount: { type: Number, required: true },
  note: { type: String, required: true },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('FundEntry', fundEntrySchema);
