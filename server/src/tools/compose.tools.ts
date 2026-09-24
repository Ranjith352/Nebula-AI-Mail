export const composeEmailToolDefinition = {
  name: 'composeEmail',
  description: 'Navigate to compose, populate To, populate Subject, and populate Body.',
  parameters: [
    { name: 'to',      type: 'string', description: 'Recipient email address', required: true },
    { name: 'subject', type: 'string', description: 'Subject line', required: true },
    { name: 'body',    type: 'string', description: 'Message body text', required: false },
  ],
}

export const replyToEmailToolDefinition = {
  name: 'replyToEmail',
  description: 'Resolve current email if context provided, prepare reply, and open compose/reply UI.',
  parameters: [
    { name: 'emailId', type: 'string', description: 'Gmail message ID to reply to', required: false },
    { name: 'body',    type: 'string', description: 'Reply message body text', required: false },
  ],
}

export const confirmSendToolDefinition = {
  name: 'confirmSend',
  description: 'Represent confirmation state before actual email send action.',
  parameters: [
    { name: 'confirmed', type: 'boolean', description: 'User confirmation flag', required: true },
  ],
}

export const forwardEmailToolDefinition = {
  name: 'forwardEmail',
  description: 'Opens forward compose for the currently opened email to a new recipient.',
  parameters: [
    { name: 'to',      type: 'string', description: 'Recipient email address to forward to', required: true },
    { name: 'emailId', type: 'string', description: 'Gmail message ID to forward', required: false },
  ],
}
