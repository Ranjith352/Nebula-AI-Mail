import { Router } from 'express'
import { copilotEndpointHandler } from '../controllers/assistant.controller'

const router = Router()

router.use('/', copilotEndpointHandler)

export default router
