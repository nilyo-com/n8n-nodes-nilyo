# n8n-nodes-nilyo

[![npm](https://img.shields.io/npm/v/n8n-nodes-nilyo.svg)](https://www.npmjs.com/package/n8n-nodes-nilyo) [![n8n community node](https://img.shields.io/badge/n8n-community%20node-ff6d5a)](https://docs.n8n.io/integrations/community-nodes/) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Use **your own LinkedIn, WhatsApp, Instagram, Telegram, Email (Gmail, Outlook, any IMAP mailbox) and Calendar accounts** from an n8n workflow — or from the n8n AI Agent — through [Nilyo](https://nilyo.com), and start workflows on realtime account events (new message, new email, account disconnected).

No browser automation, no scraping: Nilyo connects your accounts once (secure hosted sign-in, or a WhatsApp/Telegram QR code) and exposes them through one authenticated endpoint. This package wraps that endpoint in two nodes.

| Node | What it does |
| --- | --- |
| **Nilyo** | Actions on your accounts: LinkedIn, Messaging (WhatsApp, Instagram, Telegram), Email, Calendar, Account, and *Any Nilyo Tool* (all 170+ tools). Usable as a **tool by the AI Agent node**. |
| **Nilyo Trigger** | Starts the workflow on realtime events such as `message.new`, `email.new` or `account.status.disconnected`. Activating the workflow registers the webhook destination in Nilyo; deactivating removes it. |

## Installation

- **Self-hosted n8n**: *Settings → Community Nodes → Install* → `n8n-nodes-nilyo`. Or `npm install n8n-nodes-nilyo` in your custom nodes directory.
- **n8n Cloud**: install from the community nodes list once the package is verified by n8n.

Requires n8n 1.0 or later (Node.js 18+).

## Credentials

1. Create a Nilyo account at [nilyo.com](https://nilyo.com) (7-day free trial, no card) and connect the provider accounts you want to use from *Connected accounts*.
2. In *Agent access*, click **Create token** → a personal token `ab_…` is shown once.
3. In n8n, create a **Nilyo API** credential with that token. Keep the default base URL (`https://nilyo.com`).

The token only reaches the accounts connected to your Nilyo user, with the same pacing and ownership checks as the Nilyo MCP. Store it in a credential, never in a workflow field or a shared template; revoke it any time from *Agent access*.

## Operations

| Resource | Operations |
| --- | --- |
| **Account** | List Connected Accounts · Get Subscription · Get Connection Link (secure link to connect or reconnect a provider account) |
| **LinkedIn** | Get Profile (from a URL, public id or provider id) · Search People · Search Companies · List My Connections · List Invitations · Send Invitation · Send Message |
| **Messaging** (WhatsApp, Instagram, Telegram) | Send to Contact by Name · List Chats · List Messages · Send Message · Start Chat |
| **Email** (Gmail, Outlook, IMAP) | List Messages · Read Message · Send Email |
| **Calendar** (Google, Microsoft) | List Calendars · List Events |
| **Any Nilyo Tool** | Call Tool — any of the 170+ Nilyo tools by name with JSON arguments (posts and comments, drafts, folders, attachments, voice notes, reactions, Sales Navigator, Recruiter, applicants, webhooks…). The tool catalogue with schemas: [nilyo.com/setup-for-agents](https://nilyo.com/setup-for-agents). |

### Trigger events

`message.new`, `message.update`, `message.delete`, `message.receipt.read`, `email.new`, `email.update`, `email.delete`, `account.add`, `account.reconnect`, `account.remove`, `account.status.disconnected`, `account.status.running`, `account.status.errored`, `account.status.degraded`, `account.initial_sync.completed` and more — the trigger loads the current list from Nilyo. Filter by provider and, optionally, by account. Payloads are delivered directly from the connection layer to your n8n webhook URL; Nilyo only manages the subscription.

## Examples

**1. WhatsApp yourself when a LinkedIn lead answers**

`Nilyo Trigger` (events: `message.new`, provider: linkedin) → `Nilyo` (Messaging → Send to Contact by Name: provider `whatsapp`, name `Me`, text `New LinkedIn message from {{ $json.payload.sender_name }}: {{ $json.payload.text }}`).

**2. Morning digest to Slack**

`Schedule` (08:00) → `Nilyo` (Email → List Messages, limit 20, `after` = yesterday) → `Nilyo` (LinkedIn → Any Nilyo Tool `linkedin_list_conversations`) → `OpenAI` / `AI Agent` (summarize) → `Slack`.

**3. Applicant intake**

`Nilyo Trigger` (`account.status.*` is not needed here; use a `Schedule`) → `Nilyo` (Any Nilyo Tool `linkedin_list_job_postings`) → `Nilyo` (Any Nilyo Tool `linkedin_classic_list_job_applicants`, `{"job_id": "{{ $json.id }}"}`) → `AI Agent` (score) → `Gmail` / `Nilyo` (Email → Send Email) to the hiring manager.

**4. AI Agent with your accounts**

Add the **Nilyo** node as a tool of the *AI Agent* node (resource *Any Nilyo Tool*): the agent can then search LinkedIn, read email and send WhatsApp messages by itself, with human-like pacing enforced by Nilyo.

## Notes for workflow authors

- **Exact IDs**: use *LinkedIn → Get Profile* to turn a profile URL into the stable provider ID before an invitation or a message; use *Messaging → Send to Contact by Name* to message a person without knowing chat IDs — it sends only when exactly one person matches and returns the candidates otherwise.
- **Several accounts of one provider**: pass the **Account ID** (from *Account → List Connected Accounts*). Nilyo never guesses which one to use.
- **Next-step results instead of errors**: when an account must be connected or reconnected, or the subscription renewed, the node returns an item with `action` (`connect_account`, `reconnect_account`, `subscribe`, `choose_account`…) and a link. Route it to a Slack or email node for the person who owns the account.
- **Pacing**: LinkedIn and Instagram are limited to about 100 actions per day per account, WhatsApp to 20 new conversations per day, and calls are serialized per account. A `PROVIDER_ACTION_LIMIT` error means the budget for today is used; do not retry in a loop.
- **Trigger payloads are lightweight**: use the IDs they contain (`account_id`, `chat_id`, `message_id`, `email_id`) with a Nilyo node to fetch the full object before acting.

## Links

- Nilyo: <https://nilyo.com> · Setup guide: <https://nilyo.com/setup-for-agents> · n8n page: <https://nilyo.com/agents/n8n>
- Source: <https://github.com/nilyo-com/n8n-nodes-nilyo> · Issues: <https://github.com/nilyo-com/n8n-nodes-nilyo/issues>
- Privacy: <https://nilyo.com/privacy> · Support: <https://nilyo.com/support> · contact@nilyo.com

Nilyo is operated by Unipile SAS. Licensed under MIT.
