import OpenAI from 'openai'
import { env } from '../../config/env'

export function createGroqClient(): { client: OpenAI; model: string } {
  console.log(`[AI Provider] Initializing Cloud Groq Client (Model: ${env.GROQ_MODEL})`)

  const client = new OpenAI({
    apiKey:  env.GROQ_API_KEY || 'dummy-key',
    baseURL: 'https://api.groq.com/openai/v1',
  })

  return { client, model: env.GROQ_MODEL }
}
