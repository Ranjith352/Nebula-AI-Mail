import mongoose, { Schema, Document } from 'mongoose'

export interface IOAuthToken extends Document {
  userId: mongoose.Types.ObjectId
  accessToken: string
  refreshToken: string
  expiryDate?: Date
  scope: string
}

const oAuthTokenSchema = new Schema<IOAuthToken>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accessToken:  { type: String, required: true },
    refreshToken: { type: String, default: '' },
    expiryDate:   { type: Date, default: null },
    scope:        { type: String, default: '' },
  },
  { timestamps: true }
)

export default mongoose.model<IOAuthToken>('OAuthToken', oAuthTokenSchema)
