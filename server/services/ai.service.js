'use strict'

const OpenAI = require('openai')

const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'composeEmail',
      description: 'Open the compose view and populate To, Subject, and Body fields.',
      parameters: {
        type: 'object',
        properties: {
          to:      { type: 'string', description: 'Recipient email address(es) — single email or multiple comma-separated email IDs' },
          subject: { type: 'string', description: 'Email subject line' },
          body:    { type: 'string', description: 'Email body text content' },
        },
        required: ['to', 'subject'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchEmails',
      description: 'Search emails by sender, keyword, date range, or unread status.',
      parameters: {
        type: 'object',
        properties: {
          sender:   { type: 'string', description: 'Sender name or email address' },
          keyword:  { type: 'string', description: 'Subject or body keyword' },
          dateFrom: { type: 'string', description: 'Start date (YYYY/MM/DD)' },
          dateTo:   { type: 'string', description: 'End date (YYYY/MM/DD)' },
          query:    { type: 'string', description: 'General search query fallback' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'filterInbox',
      description: 'Apply UI filters (unread, date range, sender, keyword) to refine inbox list.',
      parameters: {
        type: 'object',
        properties: {
          sender:   { type: 'string', description: 'Sender name or email' },
          keyword:  { type: 'string', description: 'Keyword in subject or body' },
          unread:   { type: 'boolean', description: 'Filter unread emails only' },
          dateFrom: { type: 'string', description: 'Start date' },
          dateTo:   { type: 'string', description: 'End date' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'openEmail',
      description: 'Open a specific email by emailId or searchHint.',
      parameters: {
        type: 'object',
        properties: {
          emailId:    { type: 'string', description: 'Gmail message ID to fetch and open' },
          searchHint: { type: 'string', description: 'Subject or sender fallback hint' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigateTo',
      description: 'Navigate to any mailbox view section (inbox, sent, compose, starred, drafts, draft, important, spam, trash, snoozed, ai, complaints).',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', description: 'Target view: inbox, sent, compose, starred, drafts, draft, important, spam, trash, snoozed, ai, complaints' },
        },
        required: ['view'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replyToEmail',
      description: 'Open reply compose view for the currently opened email.',
      parameters: {
        type: 'object',
        properties: {
          emailId: { type: 'string', description: 'Gmail message ID to reply to' },
          body:    { type: 'string', description: 'Reply body text' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmSend',
      description: 'Represent confirmation state before actual send action.',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean', description: 'Whether the user confirmed to send' },
        },
        required: ['confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forwardEmail',
      description: 'Forward an email to a new recipient.',
      parameters: {
        type: 'object',
        properties: {
          to:      { type: 'string', description: 'Recipient email address(es) — single or multiple comma-separated email IDs' },
          emailId: { type: 'string', description: 'Gmail message ID to forward' },
        },
        required: ['to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearFilters',
      description: 'Reset all active inbox search filters.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

function getClientAndModel() {
  const provider = (process.env.LLM_PROVIDER || 'groq').toLowerCase()
  if (provider === 'ollama') {
    const rawBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const baseURL = rawBase.endsWith('/v1') ? rawBase : `${rawBase.replace(/\/$/, '')}/v1`
    const model = process.env.OLLAMA_MODEL || 'llama3.2'
    return {
      client: new OpenAI({ apiKey: 'ollama', baseURL }),
      model,
    }
  }

  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'
  return {
    client: new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: 'https://api.groq.com/openai/v1',
    }),
    model,
  }
}

async function processChatMessage({ message, history = [], context = {} }) {
  const { client, model } = getClientAndModel()

  const systemPrompt = `You are Nebula AI, an intelligent email co-pilot that controls a MERN-stack Gmail web client.

CRITICAL DIRECTIVES:
1. Keep all responses concise, direct, and brief (1-2 sentences maximum). Do not generate long explanations or reasoning.
2. Current System Date/Time: ${new Date().toISOString()} (${new Date().toDateString()})
3. Current Application Context:
${JSON.stringify(context, null, 2)}

4. CONTEXTUAL RESOLUTION:
   - When the user says "Reply to this" or "Reply to this email", "this" strictly refers to context.currentEmailId. Call 'replyToEmail' with emailId = context.currentEmailId.
   - When the user says "Forward this to John" or "Forward this email to X", "this" strictly refers to context.currentEmailId. Call 'forwardEmail' with to = recipient name/address and emailId = context.currentEmailId.
   - If context.currentEmailId is null, respond: "No email is currently open. Please open an email first."

5. MULTI-RECIPIENT SUPPORT:
   - You can send, compose, or forward emails to multiple recipient email IDs simultaneously by passing a comma-separated list of email addresses in the 'to' parameter (e.g. "user1@example.com, user2@example.com").

6. TOOL CALLING & RESPONSE RULES:
   - When instructed to compose, write, send, reply, forward, search, filter, open, or navigate, IMMEDIATELY call the appropriate tool.
   - NEVER output raw JSON, tool call arguments, database IDs, internal function names, or code snippets in text responses.
   - Speak in natural, concise, polished English (e.g., "Opened Sent.", "Showing unread emails from this week.", "I found 1 email from Naukri.").
   - Do NOT search first when asked to compose or send unless explicitly requested.
   - NEVER invent or synthesize fake email IDs.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-4).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: AI_TOOLS,
      tool_choice: 'auto',
      max_completion_tokens: 400,
      reasoning_effort: 'none',
    })

    const responseMessage = response.choices[0]?.message
    const textContent = responseMessage?.content || ''
    const toolCalls = responseMessage?.tool_calls || []

    let executedTool = null
    if (toolCalls.length > 0) {
      const call = toolCalls[0]
      let args = {}
      try {
        args = JSON.parse(call.function.arguments)
      } catch (e) {
        args = {}
      }
      executedTool = {
        name: call.function.name,
        args,
      }
    }

    // Fallback: If LLM generated text claiming to send an email or user asked to send/compose, but omitted toolCall
    if (!executedTool && /(send|compose|write|mail)/i.test(message)) {
      const emailMatches = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
      if (emailMatches && emailMatches.length > 0) {
        const to = emailMatches.join(', ')

        let subject = 'Message'
        const subjMatch = message.match(/subject\s+(?:is|as|:)?\s*["']?([^"'`\n]+?)(?:["']?\s+(?:and\s+)?(?:body|content|message|text)\b|$)/i)
        if (subjMatch && subjMatch[1]) {
          subject = subjMatch[1].trim()
        }

        let body = ''
        const bodyMatch = message.match(/(?:body|content|message|text)\s+(?:is|as|:)?\s*["']?([^"'`\n]+)["']?$/i)
        if (bodyMatch && bodyMatch[1]) {
          body = bodyMatch[1].trim()
        }

        console.log(`[AI SERVICE FALLBACK] LLM omitted tool call. Constructed composeEmail tool call: to="${to}", subject="${subject}", body="${body}"`)
        executedTool = {
          name: 'composeEmail',
          args: { to, subject, body }
        }
      }
    }

    return {
      message: textContent,
      toolCall: executedTool,
    }
  } catch (err) {
    console.error('[AI Service Error]', err.message, err.status || err.code)
    if (err.status === 429 || err.code === 429 || err.message?.includes('429') || err.message?.includes('Limit')) {
      return {
        message: 'AI service rate limit reached. Please try again shortly.',
        toolCall: null,
        error: 'AI service rate limit reached. Please try again shortly.',
      }
    }
    return {
      message: 'AI assistant is currently busy. Please try again in a moment.',
      toolCall: null,
      error: err.message || 'AI processing error',
    }
  }
}

async function generateAIInsights({ userId, userEmail }) {
  console.log(`[AI INSIGHTS] Loading data for user ${userEmail} (${userId})`)

  const EmailCache = require('../models/EmailCache')

  const totalAnalyzed = await EmailCache.countDocuments({ userId })
  console.log(`[AI INSIGHTS] Emails analyzed: ${totalAnalyzed}`)

  const unreadCount = await EmailCache.countDocuments({ userId, isRead: false })
  const importantCount = await EmailCache.countDocuments({ userId, labels: 'IMPORTANT' })
  const starredCount = await EmailCache.countDocuments({ userId, labels: 'STARRED' })
  const sentCount = await EmailCache.countDocuments({ userId, labels: 'SENT' })

  // Aggregated top senders
  const topSendersAgg = await EmailCache.aggregate([
    { $match: { userId } },
    { $group: { _id: '$sender', count: { $sum: 1 }, email: { $first: '$senderEmail' } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ])

  const topSenders = topSendersAgg.map(s => ({
    name: s._id || s.email || 'Unknown',
    email: s.email || s._id || '',
    count: s.count
  }))

  // Pending / Action items (recent unread or important messages)
  const actionMessages = await EmailCache.find({
    userId,
    $or: [
      { isRead: false },
      { labels: 'IMPORTANT' }
    ]
  })
  .sort({ internalDate: -1 })
  .limit(6)
  .lean()

  const actionItems = actionMessages.map(m => ({
    id: m.gmailId || m.id,
    subject: m.subject || '(no subject)',
    sender: m.sender || m.from || m.senderEmail || 'Sender',
    snippet: m.snippet || '',
    receivedAt: m.receivedAt || m.date,
    isRead: m.isRead,
  }))

  // Sample recent message subjects to infer topics
  const recentDocs = await EmailCache.find({ userId })
    .select('subject snippet labels')
    .sort({ internalDate: -1 })
    .limit(20)
    .lean()

  const sampleText = recentDocs.map(d => `Subject: ${d.subject} | Snippet: ${d.snippet}`).join('\n')

  let summary = `You have ${unreadCount} unread message(s) and ${importantCount} important message(s) out of ${totalAnalyzed} total synchronized emails.`
  let topics = ['Inbox Overview', 'Workspace Communications', 'Updates']

  try {
    const { client, model } = getClientAndModel()
    const prompt = `Analyze these recent email headers & snippets for user ${userEmail}:
${sampleText.slice(0, 1500)}

Provide a concise 2-sentence executive summary of current email activity and a JSON list of 3-5 main topics.
Respond strictly in JSON format:
{
  "summary": "...",
  "topics": ["Topic 1", "Topic 2", "Topic 3"]
}`

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 400,
    })

    console.log(`[AI INSIGHTS] Groq response received`)
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')
    if (parsed.summary) summary = parsed.summary
    if (Array.isArray(parsed.topics) && parsed.topics.length > 0) topics = parsed.topics
  } catch (err) {
    console.warn('[AI INSIGHTS] LLM summary fallback:', err.message)
  }

  return {
    stats: {
      totalAnalyzed,
      unread: unreadCount,
      important: importantCount,
      starred: starredCount,
      sent: sentCount
    },
    topSenders,
    topics,
    actionItems,
    summary,
  }
}

module.exports = { processChatMessage, generateAIInsights }
