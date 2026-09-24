import { Router } from 'express'
import passport from 'passport'
import { getMe, logout, googleCallbackRedirect } from '../controllers/auth.controller'

const router = Router()

router.get('/google', passport.authenticate('google', {
  scope: [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  accessType: 'offline',
  prompt: 'consent',
}))

router.get('/me', getMe)
router.get('/logout', logout)

export default router
