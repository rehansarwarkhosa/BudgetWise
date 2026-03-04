import mongoose from 'mongoose';

const subTopicSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

export default mongoose.model('SubTopic', subTopicSchema);
