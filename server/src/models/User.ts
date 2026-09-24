import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  googleId: string
  email: string
  name: string
  picture: string
  accessToken: string
  refreshToken: string
  historyId?: string
  watchExpiry?: Date | null
  lastSync?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

const userSchema = new Schema<IUser>(
  {
    googleId:     { type: String, required: true, unique: true, index: true },
    email:        { type: String, required: true, unique: true },
    name:         { type: String, default: '' },
    picture:      { type: String, default: '' },
    accessToken:  { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    historyId:    { type: String, default: '' },
    watchExpiry:  { type: Date,   default: null },
    lastSync:     { type: Date,   default: null },
  },
  { timestamps: true }
)

export default mongoose.model<IUser>('User', userSchema)
