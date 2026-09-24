import { Router } from 'express'
import { handleGmailPushNotification } from '../controllers/webhook.controller'

const router = Router()

router.post('/gmail', handleGmailPushNotification)

export default router
