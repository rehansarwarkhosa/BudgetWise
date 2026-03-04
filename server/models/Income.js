import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  source: { type: String, required: true },
  date: { type: Date, default: Date.now },
  period: {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
  },
  deficitNote: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Income', incomeSchema);
