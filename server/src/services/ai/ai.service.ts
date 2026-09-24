import OpenAI from 'openai'
import { env } from '../../config/env'

export function getAIClientAndModel(): { client: OpenAI; model: string } {
  const provider = env.LLM_PROVIDER
  if (provider === 'ollama') {
    const rawBase = env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const baseURL = rawBase.endsWith('/v1') ? rawBase : `${rawBase.replace(/\/$/, '')}/v1`
    const model = env.OLLAMA_MODEL || 'llama3.2'
    return {
      client: new OpenAI({ apiKey: 'ollama', baseURL }),
      model,
    }
  }

  const apiKey = env.GROQ_API_KEY
  const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  return {
    client: new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: 'https://api.groq.com/openai/v1',
    }),
    model,
  }
}
