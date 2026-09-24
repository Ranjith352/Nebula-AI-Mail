import mongoose, { Schema, Document } from 'mongoose'

export interface IAssistantSession extends Document {
  userId: mongoose.Types.ObjectId
  sessionId: string
  context?: Record<string, any>
  lastActive: Date
}

const assistantSessionSchema = new Schema<IAssistantSession>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId:  { type: String, required: true, unique: true, index: true },
    context:    { type: Schema.Types.Mixed, default: {} },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

export default mongoose.model<IAssistantSession>('AssistantSession', assistantSessionSchema)
