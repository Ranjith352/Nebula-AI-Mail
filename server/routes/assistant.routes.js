'use strict'

/**
 * Assistant Routes — Express API endpoint for Nebula AI assistant chat & tool calling.
 *
 * Route:
 *   POST /api/assistant/chat
 *
 * Payload:
 *   { message: string, history: Array, context: Object }
 *
 * Response:
 *   { message: string, toolCall: { name: string, args: Object } | null }
 */

const express = require('express')
const { requireAuth } = require('../middleware/auth.middleware')
const { processChatMessage } = require('../services/ai.service')

const router = express.Router()

router.use(requireAuth)

router.post('/chat', async (req, res, next) => {

  try {
    const { message, history = [], context = {} } = req.body || {}

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message field is required.' })
    }

    const result = await processChatMessage({ message, history, context })
    return res.json(result)
  } catch (err) {
    console.error('[Assistant Route Error]', err.stack || err.message)
    return res.status(500).json({
      message: 'Nebula AI Co-Pilot is currently unable to process your request. Please try again in a moment.',
    })
  }
})

module.exports = router
