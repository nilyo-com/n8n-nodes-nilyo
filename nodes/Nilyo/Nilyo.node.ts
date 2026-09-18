import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";
import { compact, nilyoRpc, nilyoTool, parseJsonField } from "./GenericFunctions";

const show = (resource: string, operation?: string) => ({ show: { resource: [resource], ...(operation ? { operation: [operation] } : {}) } });
const accountIdField = (resource: string, operations: string[]) => ({
  displayName: "Account ID",
  name: "accountId",
  type: "string" as const,
  default: "",
  description: "Optional Nilyo connection ID (unipile_account_id from Account → List). Needed only when several accounts of the same provider are connected; otherwise Nilyo selects the single matching account.",
  displayOptions: { show: { resource: [resource], operation: operations } },
});
const providerField = (resource: string, operations: string[], options: string[]) => ({
  displayName: "Provider",
  name: "provider",
  type: "options" as const,
  options: options.map((value) => ({ name: value.charAt(0).toUpperCase() + value.slice(1), value })),
  default: options[0],
  displayOptions: { show: { resource: [resource], operation: operations } },
});
const jsonField = (name: string, displayName: string, resource: string, operations: string[], description: string) => ({
  displayName,
  name,
  type: "json" as const,
  default: "{}",
  description,
  displayOptions: { show: { resource: [resource], operation: operations } },
});

export class Nilyo implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Nilyo",
    name: "nilyo",
    icon: "file:nilyo.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Use your own LinkedIn, WhatsApp, Instagram, Telegram, Email and Calendar accounts through Nilyo",
    defaults: { name: "Nilyo" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: "nilyoApi", required: true }],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Account", value: "account" },
          { name: "LinkedIn", value: "linkedin" },
          { name: "Messaging (WhatsApp, Instagram, Telegram)", value: "messaging" },
          { name: "Email", value: "email" },
          { name: "Calendar", value: "calendar" },
          { name: "Any Nilyo Tool", value: "tool" },
        ],
        default: "linkedin",
      },
      // Account
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("account"),
        options: [
          { name: "List Connected Accounts", value: "list", action: "List connected accounts", description: "Providers, owner names, identifiers, status and reconnection hints" },
          { name: "Get Subscription", value: "subscription", action: "Get subscription", description: "Plan, trial, seats and available billing actions" },
          { name: "Get Connection Link", value: "connect", action: "Get a connection link", description: "Secure Hosted Auth link to connect a new account or reconnect an existing one" },
        ],
        default: "list",
      },
      providerField("account", ["connect"], ["linkedin", "whatsapp", "instagram", "telegram", "google", "outlook", "imap", "email"]),
      { displayName: "Account ID to Reconnect", name: "reconnectAccountId", type: "string", default: "", description: "Leave empty to connect a new account", displayOptions: show("account", "connect") },
      // LinkedIn
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("linkedin"),
        options: [
          { name: "Get Profile", value: "getProfile", action: "Get a LinkedIn profile", description: "From a profile URL, public identifier or provider user ID; returns the stable ID used by actions" },
          { name: "Search People", value: "searchPeople", action: "Search LinkedIn people" },
          { name: "Search Companies", value: "searchCompanies", action: "Search LinkedIn companies" },
          { name: "List My Connections", value: "myConnections", action: "List my LinkedIn connections" },
          { name: "List Invitations", value: "listInvitations", action: "List LinkedIn invitations" },
          { name: "Send Invitation", value: "sendInvitation", action: "Send a LinkedIn invitation" },
          { name: "Send Message", value: "sendMessage", action: "Send a LinkedIn message in an existing chat" },
        ],
        default: "getProfile",
      },
      accountIdField("linkedin", ["getProfile", "searchPeople", "searchCompanies", "myConnections", "listInvitations", "sendInvitation", "sendMessage"]),
      { displayName: "Profile URL or ID", name: "userIdOrUrl", type: "string", default: "", required: true, placeholder: "https://www.linkedin.com/in/jane-doe/", displayOptions: show("linkedin", "getProfile") },
      { displayName: "Keywords", name: "keywords", type: "string", default: "", displayOptions: { show: { resource: ["linkedin"], operation: ["searchPeople", "searchCompanies"] } } },
      jsonField("filters", "Additional Filters (JSON)", "linkedin", ["searchPeople", "searchCompanies"], 'Provider filter IDs, e.g. {"location":["102277331"]}. Resolve human names with the linkedin_get_search_parameters tool first.'),
      { displayName: "Search", name: "search", type: "string", default: "", description: "Optional name filter inside your connections", displayOptions: show("linkedin", "myConnections") },
      { displayName: "Type", name: "invitationType", type: "options", options: [{ name: "Received", value: "received" }, { name: "Sent", value: "sent" }], default: "received", displayOptions: show("linkedin", "listInvitations") },
      { displayName: "LinkedIn User ID", name: "userId", type: "string", default: "", required: true, description: "Stable provider user ID returned by Get Profile / Search People (never a URL or a name)", displayOptions: show("linkedin", "sendInvitation") },
      { displayName: "Message", name: "message", type: "string", default: "", typeOptions: { rows: 3 }, displayOptions: show("linkedin", "sendInvitation") },
      { displayName: "Chat ID", name: "chatId", type: "string", default: "", required: true, displayOptions: show("linkedin", "sendMessage") },
      { displayName: "Text", name: "text", type: "string", default: "", required: true, typeOptions: { rows: 4 }, displayOptions: show("linkedin", "sendMessage") },
      // Messaging
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("messaging"),
        options: [
          { name: "Send to Contact by Name", value: "sendToContact", action: "Send a message to a person by name", description: "Resolves the recipient from recent chats and contacts; sends only when exactly one person matches" },
          { name: "List Chats", value: "listChats", action: "List chats" },
          { name: "List Messages", value: "listMessages", action: "List messages of a chat" },
          { name: "Send Message", value: "sendMessage", action: "Send a message in an existing chat" },
          { name: "Start Chat", value: "startChat", action: "Start a new chat with a provider user ID" },
        ],
        default: "sendToContact",
      },
      accountIdField("messaging", ["sendToContact", "listChats", "listMessages", "sendMessage", "startChat"]),
      providerField("messaging", ["sendToContact", "listChats", "startChat"], ["whatsapp", "instagram", "telegram"]),
      { displayName: "Recipient Name or Phone", name: "recipientName", type: "string", default: "", required: true, placeholder: "Julien Dupont or 33612345678", displayOptions: show("messaging", "sendToContact") },
      { displayName: "Recipient User ID", name: "recipientUserId", type: "string", default: "", description: "Exact provider user ID chosen after an ambiguous result; skips name matching", displayOptions: show("messaging", "sendToContact") },
      { displayName: "Chat ID", name: "chatId", type: "string", default: "", required: true, displayOptions: { show: { resource: ["messaging"], operation: ["listMessages", "sendMessage"] } } },
      { displayName: "Provider User ID", name: "usersIds", type: "string", default: "", required: true, description: "Exact provider user ID (from contacts/profile resolution), never a display name", displayOptions: show("messaging", "startChat") },
      { displayName: "Text", name: "text", type: "string", default: "", required: true, typeOptions: { rows: 4 }, displayOptions: { show: { resource: ["messaging"], operation: ["sendToContact", "sendMessage", "startChat"] } } },
      { displayName: "Limit", name: "limit", type: "number", default: 50, typeOptions: { minValue: 1, maxValue: 250 }, displayOptions: { show: { resource: ["messaging"], operation: ["listChats", "listMessages"] } } },
      { displayName: "Unread Only", name: "isUnread", type: "boolean", default: false, displayOptions: show("messaging", "listChats") },
      // Email
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("email"),
        options: [
          { name: "List Messages", value: "list", action: "List emails" },
          { name: "Read Message", value: "read", action: "Read an email" },
          { name: "Send Email", value: "send", action: "Send an email" },
        ],
        default: "list",
      },
      accountIdField("email", ["list", "read", "send"]),
      { displayName: "Folder ID", name: "folderId", type: "string", default: "", description: "Optional exact folder ID (email_list_folders); required for most IMAP mailboxes", displayOptions: show("email", "list") },
      { displayName: "Limit", name: "limit", type: "number", default: 20, typeOptions: { minValue: 1, maxValue: 250 }, displayOptions: show("email", "list") },
      { displayName: "Email ID", name: "emailId", type: "string", default: "", required: true, displayOptions: show("email", "read") },
      { displayName: "To", name: "to", type: "string", default: "", required: true, description: "Comma-separated addresses", displayOptions: show("email", "send") },
      { displayName: "CC", name: "cc", type: "string", default: "", displayOptions: show("email", "send") },
      { displayName: "BCC", name: "bcc", type: "string", default: "", displayOptions: show("email", "send") },
      { displayName: "Subject", name: "subject", type: "string", default: "", displayOptions: show("email", "send") },
      { displayName: "Text", name: "plainText", type: "string", default: "", typeOptions: { rows: 6 }, displayOptions: show("email", "send") },
      { displayName: "HTML", name: "html", type: "string", default: "", typeOptions: { rows: 6 }, displayOptions: show("email", "send") },
      { displayName: "Reply to Message ID", name: "replyToMessageId", type: "string", default: "", description: "Provider email ID (Gmail/Outlook) or RFC822 Message-ID (IMAP) of the email being answered", displayOptions: show("email", "send") },
      // Calendar
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("calendar"),
        options: [
          { name: "List Calendars", value: "listCalendars", action: "List calendars" },
          { name: "List Events", value: "listEvents", action: "List calendar events" },
        ],
        default: "listCalendars",
      },
      accountIdField("calendar", ["listCalendars", "listEvents"]),
      { displayName: "Calendar ID", name: "calendarId", type: "string", default: "", required: true, displayOptions: show("calendar", "listEvents") },
      { displayName: "Start (ISO 8601)", name: "start", type: "string", default: "", displayOptions: show("calendar", "listEvents") },
      { displayName: "End (ISO 8601)", name: "end", type: "string", default: "", displayOptions: show("calendar", "listEvents") },
      // Any tool
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("tool"),
        options: [{ name: "Call Tool", value: "call", action: "Call any Nilyo tool" }],
        default: "call",
      },
      {
        displayName: "Tool",
        name: "toolName",
        type: "options",
        typeOptions: { loadOptionsMethod: "getTools" },
        default: "",
        required: true,
        description: "Any of the Nilyo MCP tools (the list is loaded from your account)",
        displayOptions: show("tool", "call"),
      },
      jsonField("toolArguments", "Arguments (JSON)", "tool", ["call"], "Arguments matching the tool's input schema. Read the tool description in the dropdown or in the Nilyo agent guide."),
    ],
  };

  methods = {
    loadOptions: {
      async getTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const result = await nilyoRpc.call(this, "tools/list", {});
        const tools = (result.tools as Array<{ name: string; description: string }>) ?? [];
        return tools.map((tool) => ({ name: tool.name, value: tool.name, description: tool.description.slice(0, 200) })).sort((a, b) => a.name.localeCompare(b.name));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const output: INodeExecutionData[] = [];
    const resource = this.getNodeParameter("resource", 0) as string;
    const operation = this.getNodeParameter("operation", 0) as string;
    const str = (name: string, index: number) => String(this.getNodeParameter(name, index, "") ?? "").trim();
    const addresses = (value: string) => value.split(",").map((email) => email.trim()).filter(Boolean).map((email) => ({ email }));

    for (let index = 0; index < items.length; index++) {
      try {
        let result: IDataObject;
        const accountId = resource === "account" || resource === "tool" ? "" : str("accountId", index);
        const base = compact({ account_id: accountId });
        if (resource === "account") {
          if (operation === "list") result = await nilyoTool.call(this, "list_connected_accounts", {});
          else if (operation === "subscription") result = await nilyoTool.call(this, "account_get_subscription", {});
          else result = await nilyoTool.call(this, "account_connect", compact({ provider: str("provider", index), account_id: str("reconnectAccountId", index) }));
        } else if (resource === "linkedin") {
          if (operation === "getProfile") result = await nilyoTool.call(this, "linkedin_get_profile", { ...base, user_id_or_url: str("userIdOrUrl", index) });
          else if (operation === "searchPeople") result = await nilyoTool.call(this, "linkedin_search_people", compact({ ...base, keywords: str("keywords", index), ...parseJsonField.call(this, this.getNodeParameter("filters", index, "{}"), "Additional Filters") }));
          else if (operation === "searchCompanies") result = await nilyoTool.call(this, "linkedin_search_companies", compact({ ...base, keywords: str("keywords", index), ...parseJsonField.call(this, this.getNodeParameter("filters", index, "{}"), "Additional Filters") }));
          else if (operation === "myConnections") result = await nilyoTool.call(this, "linkedin_list_my_connections", compact({ ...base, search: str("search", index) }));
          else if (operation === "listInvitations") result = await nilyoTool.call(this, "linkedin_list_invitations", { ...base, type: str("invitationType", index) || "received" });
          else if (operation === "sendInvitation") result = await nilyoTool.call(this, "linkedin_send_invitation", compact({ ...base, user_id: str("userId", index), message: str("message", index) }));
          else result = await nilyoTool.call(this, "linkedin_send_message", { ...base, chat_id: str("chatId", index), text: str("text", index) });
        } else if (resource === "messaging") {
          if (operation === "sendToContact") result = await nilyoTool.call(this, "messaging_send_to_contact", compact({ ...base, provider: str("provider", index), name: str("recipientName", index), text: str("text", index), recipient_user_id: str("recipientUserId", index) }));
          else if (operation === "listChats") result = await nilyoTool.call(this, "messaging_list_chats", compact({ ...base, provider: str("provider", index), limit: this.getNodeParameter("limit", index, 50), is_unread: this.getNodeParameter("isUnread", index, false) ? true : undefined }));
          else if (operation === "listMessages") result = await nilyoTool.call(this, "messaging_list_messages", compact({ ...base, chat_id: str("chatId", index), limit: this.getNodeParameter("limit", index, 50) }));
          else if (operation === "sendMessage") result = await nilyoTool.call(this, "messaging_send_message", { ...base, chat_id: str("chatId", index), text: str("text", index) });
          else result = await nilyoTool.call(this, "messaging_start_chat", { ...base, provider: str("provider", index), users_ids: str("usersIds", index), text: str("text", index) });
        } else if (resource === "email") {
          if (operation === "list") result = await nilyoTool.call(this, "email_list_messages", compact({ ...base, folder_id: str("folderId", index), limit: this.getNodeParameter("limit", index, 20) }));
          else if (operation === "read") result = await nilyoTool.call(this, "email_read_message", { ...base, email_id: str("emailId", index) });
          else result = await nilyoTool.call(this, "email_send", compact({ ...base, to: addresses(str("to", index)), cc: addresses(str("cc", index)), bcc: addresses(str("bcc", index)), subject: str("subject", index), plain_text: str("plainText", index), html: str("html", index), reply_to_message_id: str("replyToMessageId", index) }));
        } else if (resource === "calendar") {
          if (operation === "listCalendars") result = await nilyoTool.call(this, "calendar_list_calendars", base);
          else result = await nilyoTool.call(this, "calendar_list_events", compact({ ...base, calendar_id: str("calendarId", index), start: str("start", index), end: str("end", index) }));
        } else {
          result = await nilyoTool.call(this, str("toolName", index), parseJsonField.call(this, this.getNodeParameter("toolArguments", index, "{}"), "Arguments"));
        }
        // Arrays (lists) become one item per element; objects stay one item.
        if (Array.isArray(result)) for (const entry of result as IDataObject[]) output.push({ json: entry, pairedItem: { item: index } });
        else output.push({ json: result, pairedItem: { item: index } });
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
          continue;
        }
        throw error;
      }
    }
    return [output];
  }
}
