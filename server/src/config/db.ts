import mongoose from 'mongoose'
import { env } from './env'

let isConnected = false

export async function connectDB(): Promise<boolean> {
  if (isConnected) return true

  const uri = env.MONGODB_URI

  if (!uri || uri.includes('<user>') || uri.includes('<password>')) {
    console.warn('[MongoDB] ⚠️  No valid MONGODB_URI found in environment.')
    console.warn('[MongoDB]    Sessions will fall back to in-memory store.')
    console.warn('[MongoDB]    Gmail API remains the authoritative source for email operations.')
    return false
  }

  try {
    await mongoose.connect(uri, {
      dbName: 'nebula',
      serverSelectionTimeoutMS: 5000,
    })
    isConnected = true
    console.log('[MongoDB] ✅ Connected to MongoDB Atlas successfully')
    return true
  } catch (err: any) {
    console.error('[MongoDB] Connection error:', err.message)
    console.warn('[MongoDB] Continuing execution without MongoDB connection.')
    return false
  }
}

export function isDBConnected(): boolean {
  return isConnected
}
