/**
 * User & Authentication Types
 */

export interface User {
  id?: string
  _id?: string
  googleId: string
  email: string
  name: string
  picture: string
  historyId?: string
  watchExpiry?: string | Date
  lastSync?: string | Date
}

export interface AuthState {
  user: User | null
  authChecked: boolean
  loading: boolean
}
