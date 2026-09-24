import OpenAI from 'openai'
import { env } from '../../config/env'

export function createOllamaClient(): { client: OpenAI; model: string } {
  const rawBase = env.OLLAMA_BASE_URL || 'http://localhost:11434'
  const baseURL = rawBase.endsWith('/v1') ? rawBase : `${rawBase.replace(/\/$/, '')}/v1`
  const model   = env.OLLAMA_MODEL || 'llama3.2'

  console.log(`[AI Provider] Initializing Local Ollama Client (${baseURL}, Model: ${model})`)

  const client = new OpenAI({
    apiKey:  'ollama',
    baseURL,
  })

  return { client, model }
}
