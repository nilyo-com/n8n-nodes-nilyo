import type {
  IDataObject,
  IHookFunctions,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";
import { compact, nilyoTool } from "./GenericFunctions";

const DEFAULT_EVENTS = ["message.new", "email.new", "account.status.disconnected"];

/**
 * Realtime trigger. On activation the node registers a Nilyo webhook destination for this workflow's webhook URL;
 * Unipile then delivers events directly to n8n (Nilyo is only the control plane) and the destination is removed on deactivation.
 */
export class NilyoTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Nilyo Trigger",
    name: "nilyoTrigger",
    icon: "file:nilyo.svg",
    group: ["trigger"],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: "Starts the workflow when something happens on your connected LinkedIn, WhatsApp, Instagram, Telegram, Email or Calendar accounts",
    defaults: { name: "Nilyo Trigger" },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "nilyoApi", required: true }],
    webhooks: [{ name: "default", httpMethod: "POST", responseMode: "onReceived", path: "webhook" }],
    properties: [
      {
        displayName: 'Event Names or IDs',
        name: "events",
        type: "multiOptions",
        typeOptions: { loadOptionsMethod: "getEvents" },
        default: [],
        required: true,
        description: 'Exact Nilyo/Unipile event types. Payloads are lightweight: use the IDs they carry with a Nilyo node to fetch the full chat, message or email. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: "Providers",
        name: "providers",
        type: "multiOptions",
        options: ["linkedin", "whatsapp", "instagram", "telegram", "google", "outlook", "imap"].map((value) => ({ name: value.charAt(0).toUpperCase() + value.slice(1), value })),
        default: [],
        description: "Optional provider filter. Empty = every connected account. Accounts connected later are added automatically.",
      },
      {
        displayName: "Destination Name",
        name: "destinationName",
        type: "string",
        default: "n8n workflow",
        description: "Shown in Nilyo's realtime destinations list",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getEvents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const result = await nilyoTool.call(this, "webhook_list_available_events", {});
        const events = (result.events as string[]) ?? DEFAULT_EVENTS;
        return events.map((event) => ({ name: event, value: event }));
      },
    },
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData("node");
        if (!data.destinationId) return false;
        try {
          const destination = await nilyoTool.call(this, "webhook_get_destination", { destination_id: data.destinationId });
          if (destination && (destination as IDataObject).request_url === this.getNodeWebhookUrl("default")) return true;
        } catch (error) {
          // the destination was likely removed on the Nilyo side; log and fall through to re-create it
          this.logger.error("Nilyo Trigger checkExists failed", { error });
        }
        delete data.destinationId;
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData("node");
        const events = this.getNodeParameter("events") as string[];
        const providers = this.getNodeParameter("providers", []) as string[];
        const destination = await nilyoTool.call(this, "webhook_create_destination", compact({
          name: String(this.getNodeParameter("destinationName", "n8n workflow") || "n8n workflow").slice(0, 100),
          runtime: "n8n",
          request_url: this.getNodeWebhookUrl("default"),
          events,
          providers,
          auto_include_new_accounts: true,
        }));
        data.destinationId = (destination as IDataObject).id;
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData("node");
        if (!data.destinationId) return true;
        try {
          await nilyoTool.call(this, "webhook_delete_destination", { destination_id: data.destinationId });
        } catch (error) {
          // already gone on the Nilyo side; log and continue cleanup
          this.logger.error("Nilyo Trigger delete failed", { error });
        }
        delete data.destinationId;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject;
    const headers = this.getHeaderData() as IDataObject;
    // Delivered straight from Unipile: keep the signature header for optional downstream verification.
    return { workflowData: [this.helpers.returnJsonArray([{ ...body, _delivery: { received_at: new Date().toISOString(), signature: headers["unipile-signature"] ?? null } }])] };
  }
}
