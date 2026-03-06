import mongoose from 'mongoose';

const budgetCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  color: { type: String, default: '#6C63FF' },
}, { timestamps: true });

export default mongoose.model('BudgetCategory', budgetCategorySchema);
