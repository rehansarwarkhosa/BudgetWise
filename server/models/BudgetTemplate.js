import mongoose from 'mongoose';

const templateItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  allocatedAmount: { type: Number, required: true },
}, { _id: true });

const budgetTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  items: [templateItemSchema],
}, { timestamps: true });

export default mongoose.model('BudgetTemplate', budgetTemplateSchema);
