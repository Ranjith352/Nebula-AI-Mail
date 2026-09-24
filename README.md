# Nebula AI Mail — Gmail-Style AI Co-Pilot Application

**Author:** [Ranjith352 (Ranjith)](https://github.com/Ranjith352)  
**Repository:** [https://github.com/Ranjith352/Nebula-AI-Mail](https://github.com/Ranjith352/Nebula-AI-Mail)  
**Stack:** React, Vite, Node.js, Express, MongoDB, Socket.IO, Gmail API, OpenAI / Groq LLM API  

---

## 🌟 Overview

**Nebula AI Mail** is an intelligent, full-stack Gmail web client powered by an embedded AI co-pilot. Built with MERN stack architecture, Socket.IO real-time synchronization, and official Google Gmail API OAuth2 integration, Nebula combines a modern dark-mode email interface with natural language control.

Unlike simple chatbots, **Nebula AI directly controls the application UI**. The AI can search emails, apply multi-parameter filters, navigate mailbox views, compose and edit drafts, pre-fill replies, and execute Gmail API sends with human-in-the-loop review.

---

## ✨ Features

- 🔐 **Google OAuth2 Authentication**: Secure user authentication with Google OAuth2 and server-side encrypted session management.
- 📬 **Full Mailbox Management**: Support for Inbox, Sent, Drafts, Starred, Important, Spam, Trash, Custom Gmail Labels, and Snoozed views.
- 🤖 **Embedded AI Co-Pilot**:
  - **Natural Language Search**: *"Show emails sent by Naukri"*, *"Find emails from Sarah about project update"*.
  - **Semantic Date Resolution**: *"Show unread emails from this week"*, *"Show me emails from the last 10 days"*.
  - **Context-Aware Replies**: *"Reply to this email saying I'll review it tomorrow"* automatically inspects the currently opened message and pre-fills the recipient, subject, and body.
  - **AI Compose & Draft Assistant**: Pre-fills recipient, subject, and message body in the controlled React form for editing and approval.
  - **UI Navigation**: *"Go to Sent"*, *"Open Trash"*, *"Show Starred"*.
- ⚡ **Real-Time Push Notifications**: Powered by Socket.IO user-isolated rooms for instant updates (`mail:new`, `email:sent`, `mail:updated`, `mail:deleted`, `sync:complete`).
- 🔄 **Incremental Gmail History Sync**: Uses Gmail `historyId` API to sync new messages efficiently without expensive full mailbox rescans.
- ✉️ **RFC 5322 MIME Engine**: Constructs clean, standards-compliant MIME emails with base64url encoding and strict header hygiene.
- 🛡️ **Human-In-The-Loop Approval**: Confirmation cards prevent unintended automatic email sends.

---

## 🚀 How to Set Up & Run Locally

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017/nebula`) or MongoDB Atlas URI
- **Google Cloud Console Credentials**: OAuth 2.0 Client ID & Secret with Gmail API scopes (`https://mail.google.com/`)
- **Groq API Key**: API key for LLM execution (`llama-3.3-70b-versatile` / `qwen3.8-27b`) or local Ollama endpoint

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/Ranjith352/Nebula-AI-Mail.git
cd Nebula-AI-Mail
```

---

### Step 2: Configure Server Environment (`server/.env`)

Create a `.env` file inside the `server/` directory (see `server/.env.example`):

```env
PORT=8000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb://localhost:27017/nebula

# Session Secret
SESSION_SECRET=your_super_secret_session_key

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8000/auth/callback

# LLM Provider Configuration
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

---

### Step 3: Configure Client Environment (`client/.env`)

Create a `.env` file inside the `client/` directory (see `client/.env.example`):

```env
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
```

---

### Step 4: Install Dependencies & Run Application

#### Terminal 1 — Start Server Backend:

```bash
cd server
npm install
npm run dev
```
*Backend server runs at `http://localhost:8000`.*

#### Terminal 2 — Start Client Frontend:

```bash
cd client
npm install
npm run dev
```
*Frontend web application runs at `http://localhost:5173`.*

---

## 🏗️ Architecture Decisions & Trade-Offs

### 1. Centralized Action Dispatcher Pattern (`aiDispatcher.js`)
- **Decision**: Separated LLM tool call interpretation from React UI mutations by introducing `dispatchAIAction()`.
- **Rationale**: Direct DOM manipulation or ad-hoc state edits by LLMs cause race conditions, broken closures, and unhandled rendering errors. The central dispatcher validates tool parameters, sanitizes input, and dispatches updates cleanly into `AppContext`.

```
User Prompt ──► LLM Tool Call ──► Action Dispatcher ──► AppContext State ──► Reactive UI
```

### 2. Single Source of Truth (`AppContext`)
- **Decision**: Maintained a unified React Context (`AppContext`) containing shared state primitives (`displayedEmails`, `inboxEmails`, `sentEmails`, `currentView`, `filters`, `openedEmail`, `composeData`).
- **Rationale**: Prevents parallel or disconnected "AI-only" UI states. When the AI filters emails or navigates tabs, the main mail components (`InboxView`, `EmailListItem`, `Header`) reactively render identical, verified state.

### 3. Write-Through MongoDB Cache + Incremental History Sync
- **Decision**: Cached email metadata and body text in MongoDB (`EmailCache`), paired with Gmail History API (`historyId`) incremental synchronization.
- **Rationale**: Fetching 100+ full emails over REST from Gmail API on every page reload causes severe rate limits and latency. MongoDB provides instant local UI rendering while background sync discovers new messages.

### Trade-Offs
- **Sync Latency vs. Freshness**: Cached emails render instantly, but first-time account sync requires initial message discovery pages. We mitigated this by displaying cached items immediately while background sync completes non-fatally.
- **Strict Client-Side Date Calculations vs. LLM Hallucinations**: LLMs frequently miscalculate dates relative to their training cutoffs. We implemented deterministic runtime date resolution (`resolveSemanticDateRange()`) on the client to translate terms like *"last 10 days"* or *"this week"* accurately.

---

## 🎮 How the AI Controls the UI

1. **Intent & Function Tool Call**: When a user submits a prompt (e.g. *"Show emails from Naukri"*), the backend LLM parses intent and returns structured tool calls (`searchEmails({ sender: 'naukri' })`).
2. **Validation & State Dispatch**: The frontend executes `dispatchAIAction('searchEmails', args, context)`.
3. **Database & API Query**: `searchEmails` executes a search query against the backend REST endpoint (`/api/emails/search?q=from:naukri`).
4. **State Mutation**: `dispatchAIAction` updates `displayedEmails` in `AppContext` with matching email objects and updates `currentView` to `'inbox'`.
5. **View Rendering**: `InboxView` renders the matching email items with full interactive handlers (star, select, read/unread, open detail).

---

## 🔮 What I’d Improve with More Time

1. **Vector-Based RAG Semantic Search**: Integrate embedding search (e.g., Pinecone or pgvector) alongside keyword search for deep semantic body query matching.
2. **Offline Support & Service Workers**: Implement IndexedDB caching and Service Worker PWA support for offline draft editing.
3. **Full Rich-Text WYSIWYG Editor**: Replace plain-text Compose textarea with a complete HTML editor (e.g., TipTap or Lexical).
4. **Automated E2E Test Suite**: Add Playwright / Cypress integration tests for automated regression testing of AI tool calls and OAuth session flows.
5. **Multi-Account Switching**: Support simultaneous login and instant switching between multiple Google Gmail accounts.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
