import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'textarea', 'number', 'date', 'time', 'rating', 'radio', 'checkbox'], required: true },
  options: [{ type: String }],
}, { _id: true });

const routineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dueDate: { type: Date, default: null },
  fields: [fieldSchema],
}, { timestamps: true });

export default mongoose.model('Routine', routineSchema);
