import mongoose from 'mongoose';

const fieldValueSchema = new mongoose.Schema({
  fieldId: { type: mongoose.Schema.Types.ObjectId, required: true },
  label: { type: String },
  value: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const routineEntrySchema = new mongoose.Schema({
  routineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Routine', required: true },
  status: { type: String, enum: ['complete', 'incomplete', 'ignored'], default: 'complete' },
  date: { type: Date, default: Date.now },
  fieldValues: [fieldValueSchema],
  manualDate: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('RoutineEntry', routineEntrySchema);
