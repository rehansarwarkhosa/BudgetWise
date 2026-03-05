import mongoose from 'mongoose';

const budgetCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
}, { timestamps: true });

export default mongoose.model('BudgetCategory', budgetCategorySchema);
