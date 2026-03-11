import mongoose from 'mongoose';

const routineNoteSchema = new mongoose.Schema({
  routineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Routine', required: true },
  content: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('RoutineNote', routineNoteSchema);
