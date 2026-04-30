import mongoose from 'mongoose';

const DeviceTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    app_id: { type: String, required: true, index: true, default: 'budgetwise' },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('DeviceToken', DeviceTokenSchema);
