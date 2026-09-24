export const searchEmailsToolDefinition = {
  name: 'searchEmails',
  description: 'Construct safe Gmail search query, fetch results, and update React email list.',
  parameters: [
    { name: 'sender',   type: 'string', description: 'Sender email or name fragment', required: false },
    { name: 'keyword',  type: 'string', description: 'Subject or body keyword', required: false },
    { name: 'dateFrom', type: 'string', description: 'Start date (YYYY/MM/DD or relative)', required: false },
    { name: 'dateTo',   type: 'string', description: 'End date (YYYY/MM/DD or relative)', required: false },
  ],
}

export const filterInboxToolDefinition = {
  name: 'filterInbox',
  description: 'Update filter state, query Gmail/backend, and update inbox list.',
  parameters: [
    { name: 'sender',   type: 'string',  description: 'Sender name or email', required: false },
    { name: 'keyword',  type: 'string',  description: 'Subject or body keyword', required: false },
    { name: 'unread',   type: 'boolean', description: 'Unread emails filter boolean', required: false },
    { name: 'dateFrom', type: 'string',  description: 'Start date filter', required: false },
    { name: 'dateTo',   type: 'string',  description: 'End date filter', required: false },
  ],
}

export const openEmailToolDefinition = {
  name: 'openEmail',
  description: 'Fetch email by emailId, update currentEmail, and navigate to EmailDetail view.',
  parameters: [
    { name: 'emailId', type: 'string', description: 'Gmail message ID to fetch and open', required: true },
  ],
}

export const openLatestEmailFromSenderToolDefinition = {
  name: 'openLatestEmailFromSender',
  description: 'Find and open the most recent email received from a specific sender.',
  parameters: [
    { name: 'sender', type: 'string', description: 'Sender name or email address', required: true },
  ],
}

export const clearFiltersToolDefinition = {
  name: 'clearFilters',
  description: 'Reset all active inbox search filters and display all inbox emails.',
  parameters: [],
}
