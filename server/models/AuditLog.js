import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('AuditLog', auditLogSchema);
