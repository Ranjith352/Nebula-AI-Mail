import mongoose, { Schema, Document } from 'mongoose'

export interface IAssistantMessage extends Document {
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<Record<string, any>>
  createdAt?: Date
}

const assistantMessageSchema = new Schema<IAssistantMessage>(
  {
    sessionId: { type: String, required: true, index: true },
    role:      { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true },
    content:   { type: String, default: '' },
    toolCalls: [{ type: Schema.Types.Mixed }],
  },
  { timestamps: true }
)

export default mongoose.model<IAssistantMessage>('AssistantMessage', assistantMessageSchema)
