import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class NilyoApi implements ICredentialType {
  name = "nilyoApi";
  displayName = "Nilyo API";
  icon = "file:../nodes/Nilyo/nilyo.svg" as const;
  documentationUrl = "https://nilyo.com/setup-for-agents";
  properties: INodeProperties[] = [
    {
      displayName: "Personal token",
      name: "token",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "Personal token (ab_…) created once from https://nilyo.com/account → Agent access. It gives this workflow access to the accounts connected to your Nilyo user only.",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://nilyo.com",
      description: "Keep the default. Use https://staging.nilyo.com only for Nilyo staging tests.",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: { headers: { Authorization: "=Bearer {{$credentials.token}}" } },
  };
  // A valid token answers the JSON-RPC call; an invalid one gets the OAuth 401 challenge.
  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/mcp",
      method: "POST",
      body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_connected_accounts", arguments: {} } },
    },
  };
}
