import { Request, Response, NextFunction } from 'express'

export function validateSendEmail(req: Request, res: Response, next: NextFunction) {
  const { to, subject } = req.body
  if (!to || typeof to !== 'string' || !to.trim()) {
    return res.status(400).json({ message: 'Recipient email address ("to") is required.' })
  }
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return res.status(400).json({ message: 'Email subject line ("subject") is required.' })
  }
  next()
}
