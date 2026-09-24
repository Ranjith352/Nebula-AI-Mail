import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || '',
  withCredentials: true,          // send session cookie
  headers: { 'Content-Type': 'application/json' },
})

// Response interceptor — surface backend error messages
api.interceptors.response.use(
  res => res,
  err => {
    return Promise.reject(err)
  },
)

/**
 * Sends a chat message to the native Express backend AI assistant (/api/assistant/chat)
 */
export async function sendAssistantMessage(message, history = [], context = {}) {
  const response = await api.post('/api/assistant/chat', {
    message,
    history,
    context,
  })
  return response.data
}

export default api
