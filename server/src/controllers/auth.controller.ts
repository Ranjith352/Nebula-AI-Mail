import { Request, Response } from 'express'
import { env } from '../config/env'

export function getMe(req: Request, res: Response) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({ user: req.user })
  }
  return res.status(401).json({ user: null })
}

export function logout(req: Request, res: Response) {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' })
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid')
      res.json({ success: true, message: 'Logged out successfully' })
    })
  })
}

export function googleCallbackRedirect(req: Request, res: Response) {
  const clientUrl = env.CLIENT_URL || 'http://localhost:5173'
  res.redirect(`${clientUrl}/`)
}
