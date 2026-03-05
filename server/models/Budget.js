import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  allocatedAmount: { type: Number, required: true },
  remainingAmount: { type: Number, required: true },
  sortOrder: { type: Number, default: 0 },
  period: {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
  },
}, { timestamps: true });

export default mongoose.model('Budget', budgetSchema);
