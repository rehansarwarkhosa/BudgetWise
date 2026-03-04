import mongoose from 'mongoose';

const savingsSchema = new mongoose.Schema({
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  amount: { type: Number, required: true },
  budgetName: { type: String, required: true },
  originalAllocation: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model('Savings', savingsSchema);
