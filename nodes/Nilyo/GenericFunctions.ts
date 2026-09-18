import type { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions, IWebhookFunctions, IDataObject, JsonObject } from "n8n-workflow";
import { NodeApiError, NodeOperationError } from "n8n-workflow";

type Ctx = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

/** JSON-RPC call to the Nilyo MCP endpoint with the personal token credential. */
export async function nilyoRpc(this: Ctx, method: string, params?: IDataObject): Promise<IDataObject> {
  const credentials = await this.getCredentials("nilyoApi");
  const baseUrl = String(credentials.baseUrl || "https://nilyo.com").replace(/\/$/, "");
  const response = (await this.helpers.httpRequestWithAuthentication.call(this, "nilyoApi", {
    method: "POST",
    url: `${baseUrl}/mcp`,
    body: { jsonrpc: "2.0", id: Date.now(), method, params: params ?? {} },
    json: true,
  })) as IDataObject;
  if (response.error) throw new NodeApiError(this.getNode(), response.error as JsonObject, { message: String((response.error as IDataObject).message ?? "Nilyo MCP error") });
  return (response.result ?? {}) as IDataObject;
}

/**
 * Call one Nilyo tool. Structured next-step actions (connect_account, reconnect_account, subscribe, choose_account…)
 * are returned as data with `action` set so the workflow can notify a human instead of failing.
 */
export async function nilyoTool(this: Ctx, name: string, args: IDataObject): Promise<IDataObject> {
  const result = await nilyoRpc.call(this, "tools/call", { name, arguments: args });
  const content = (result.content as Array<{ type: string; text?: string }> | undefined) ?? [];
  const text = content.find((item) => item.type === "text")?.text ?? "";
  if (result.isError) {
    const structured = result.structuredContent as IDataObject | undefined;
    const error = (structured?.error as IDataObject | undefined) ?? {};
    throw new NodeOperationError(this.getNode(), String(error.message ?? text ?? "Nilyo tool failed"), { description: error.code ? `${error.code}${error.next_tools ? ` — next: ${(error.next_tools as string[]).join(", ")}` : ""}` : undefined });
  }
  if (result.structuredContent !== undefined && result.structuredContent !== null) return result.structuredContent as IDataObject;
  try {
    return JSON.parse(text) as IDataObject;
  } catch {
    return { text };
  }
}

/** Remove empty optional fields so the MCP schema validation only sees what the user filled in. */
export function compact(input: IDataObject): IDataObject {
  const out: IDataObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

export function parseJsonField(this: Ctx, value: unknown, field: string): IDataObject {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "object") return value as IDataObject;
  try {
    return JSON.parse(String(value)) as IDataObject;
  } catch {
    throw new NodeOperationError(this.getNode(), `${field} must be valid JSON`);
  }
}
