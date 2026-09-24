const mongoose = require('mongoose')

let isConnected = false

async function connectDB() {
  if (isConnected) return

  const uri = process.env.MONGODB_URI

  if (!uri || uri.includes('<user>') || uri.includes('<password>')) {
    console.warn('[MongoDB] ⚠️  No valid MONGODB_URI found.')
    console.warn('[MongoDB]    Sessions will use in-memory store (restarts clear sessions).')
    console.warn('[MongoDB]    Email caching is disabled. Gmail remains the authoritative source.')
    // Don't crash — email fetching from Gmail still works without MongoDB.
    // Sessions will use in-memory store (set in index.js fallback).
    return
  }

  try {
    await mongoose.connect(uri, { dbName: 'nebula', serverSelectionTimeoutMS: 5000 })
    isConnected = true
    console.log('[MongoDB] ✅ Connected successfully')
  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message)
    console.warn('[MongoDB] Continuing without MongoDB — Gmail still works.')
    // Don't process.exit — allow the server to run without DB.
  }
}

/** True only after a successful connection */
function isDBConnected() {
  return isConnected
}

module.exports = { connectDB, isDBConnected }
