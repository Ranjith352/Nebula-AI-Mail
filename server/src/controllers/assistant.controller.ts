import { Request, Response } from 'express'
import { copilotRuntimeNodeExpressEndpoint } from '@copilotkit/runtime'
import { createCopilotRuntime, getServiceAdapter } from '../services/ai/ai.service'

const serviceAdapter = getServiceAdapter()
const runtime = createCopilotRuntime()

export const copilotEndpointHandler = copilotRuntimeNodeExpressEndpoint({
  endpoint: '/api/copilotkit',
  runtime,
  serviceAdapter,
})
