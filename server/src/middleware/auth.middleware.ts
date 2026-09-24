import { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next()
  }
  return res.status(401).json({ message: 'Unauthorized — please sign in with Google' })
}
