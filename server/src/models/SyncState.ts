import mongoose, { Schema, Document } from 'mongoose'

export interface ISyncState extends Document {
  userId: mongoose.Types.ObjectId
  historyId: string
  lastSyncAt: Date
  watchExpiration?: Date | null
  status: 'idle' | 'syncing' | 'error'
  lastError?: string
}

const syncStateSchema = new Schema<ISyncState>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    historyId:       { type: String, default: '' },
    lastSyncAt:      { type: Date, default: Date.now },
    watchExpiration: { type: Date, default: null },
    status:          { type: String, enum: ['idle', 'syncing', 'error'], default: 'idle' },
    lastError:       { type: String, default: '' },
  },
  { timestamps: true }
)

export default mongoose.model<ISyncState>('SyncState', syncStateSchema)
