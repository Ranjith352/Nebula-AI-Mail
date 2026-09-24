export const navigationToolDefinition = {
  name: 'navigateTo',
  description: 'Navigate to a different view section in the app (inbox, sent, compose).',
  parameters: [
    { name: 'view', type: 'string', description: 'Destination view: inbox, sent, or compose', required: true },
  ],
}
