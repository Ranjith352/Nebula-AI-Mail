import dotenv from 'dotenv'

dotenv.config()

export const env = {
  PORT: parseInt(process.env.PORT || '8000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  SESSION_SECRET: process.env.SESSION_SECRET || 'nebula-secret-key-change-in-prod',
  MONGODB_URI: process.env.MONGODB_URI || '',

  // Google OAuth & Gmail API
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/api/emails/callback',
  GMAIL_COMPLAINTS_LABEL: process.env.GMAIL_COMPLAINTS_LABEL || 'Complaints',

  // Pub/Sub Push Notifications
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
  PUBSUB_TOPIC_NAME: process.env.PUBSUB_TOPIC_NAME || '',
  PUBSUB_SUBSCRIPTION_NAME: process.env.PUBSUB_SUBSCRIPTION_NAME || '',

  // Generative AI Provider
  LLM_PROVIDER: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3.2',
}
