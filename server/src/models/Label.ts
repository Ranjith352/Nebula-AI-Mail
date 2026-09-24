import mongoose, { Schema, Document } from 'mongoose'

export interface ILabel extends Document {
  userId: mongoose.Types.ObjectId
  id: string
  name: string
  type: 'system' | 'user'
  messagesTotal: number
  messagesUnread: number
  threadsTotal: number
  threadsUnread: number
  color?: {
    textColor?: string
    backgroundColor?: string
  }
}

const labelSchema = new Schema<ILabel>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    id:              { type: String, required: true },
    name:            { type: String, required: true },
    type:            { type: String, enum: ['system', 'user'], default: 'user' },
    messagesTotal:   { type: Number, default: 0 },
    messagesUnread:  { type: Number, default: 0 },
    threadsTotal:    { type: Number, default: 0 },
    threadsUnread:   { type: Number, default: 0 },
    color: {
      textColor:       { type: String, default: '#ffffff' },
      backgroundColor: { type: String, default: '#4285f4' },
    },
  },
  { timestamps: true }
)

labelSchema.index({ userId: 1, id: 1 }, { unique: true })

export default mongoose.model<ILabel>('Label', labelSchema)
