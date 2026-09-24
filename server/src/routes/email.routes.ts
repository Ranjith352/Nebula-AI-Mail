import { Router } from 'express'
import passport from 'passport'
import { requireAuth } from '../middleware/auth.middleware'
import { validateSendEmail } from '../middleware/validation.middleware'
import {
  getInbox,
  getSent,
  getComplaints,
  search,
  send,
  getById,
  markRead,
} from '../controllers/email.controller'
import { env } from '../config/env'

const router = Router()

// OAuth callback landing endpoint registered in Google Cloud Console
router.get(
  '/callback',
  passport.authenticate('google', {
    failureRedirect: `${env.CLIENT_URL}/?error=auth_failed`,
  }),
  (req, res) => {
    res.redirect(`${env.CLIENT_URL}/`)
  }
)

router.use(requireAuth)

router.get('/inbox', getInbox)
router.get('/sent', getSent)
router.get('/complaints', getComplaints)
router.get('/search', search)
router.post('/send', validateSendEmail, send)
router.post('/:id/read', markRead)
router.get('/:id', getById)

export default router
