import { BaseRestConnector } from "./base-connectors";

type RestAuthMode = "none" | "api_key" | "bearer" | "basic" | "oauth2_client_credentials";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export class RestApiConnector extends BaseRestConnector {
  async test(): Promise<Record<string, unknown>> {
    const testPath = asString(this.connector.config.testPath) ?? "/";
    return this.request({ method: "GET", path: testPath });
  }

  async request(input: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<Record<string, unknown>> {
    const url = await this.buildUrl(input.path);
    const headers = await this.buildHeaders(input.headers ?? {});
    const method = input.method.toUpperCase();
    const hasBody = input.body !== undefined && !["GET", "HEAD"].includes(method);

    const res = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(input.body) : undefined,
    });
    const text = await res.text();
    let responseBody: unknown = text;
    try {
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = text.slice(0, 4000);
    }

    if (!res.ok) {
      throw new Error(`REST connector failed with ${res.status}: ${text.slice(0, 500)}`);
    }

    return {
      status: res.status,
      statusText: res.statusText,
      body: responseBody,
    };
  }

  private async buildUrl(path: string) {
    const baseUrl = asString(this.connector.config.baseUrl);
    if (!baseUrl) throw new Error("REST connector requires configJson.baseUrl");
    const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

    const auth = asRecord(this.connector.config.auth);
    const mode = (asString(auth.mode) ?? "none") as RestAuthMode;
    if (mode === "api_key" && asString(auth.location) === "query") {
      const paramName = asString(auth.name) ?? "api_key";
      const apiKey = asString(this.connector.secrets.apiKey);
      if (!apiKey) throw new Error("REST API key auth requires secretsJson.apiKey");
      url.searchParams.set(paramName, apiKey);
    }
    return url.toString();
  }

  private async buildHeaders(actionHeaders: Record<string, string>) {
    const configuredHeaders = asRecord(this.connector.config.defaultHeaders);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...Object.fromEntries(
        Object.entries(configuredHeaders).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
      ...actionHeaders,
    };

    const auth = asRecord(this.connector.config.auth);
    const mode = (asString(auth.mode) ?? "none") as RestAuthMode;
    if (mode === "api_key" && (asString(auth.location) ?? "header") === "header") {
      const headerName = asString(auth.name) ?? "X-API-Key";
      const apiKey = asString(this.connector.secrets.apiKey);
      if (!apiKey) throw new Error("REST API key auth requires secretsJson.apiKey");
      headers[headerName] = apiKey;
    }
    if (mode === "bearer") {
      const token = asString(this.connector.secrets.bearerToken);
      if (!token) throw new Error("REST bearer auth requires secretsJson.bearerToken");
      headers.Authorization = `Bearer ${token}`;
    }
    if (mode === "basic") {
      const username = asString(this.connector.secrets.username);
      const password = asString(this.connector.secrets.password);
      if (!username || !password) throw new Error("REST basic auth requires username and password secrets");
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }
    if (mode === "oauth2_client_credentials") {
      headers.Authorization = `Bearer ${await this.fetchOAuthToken()}`;
    }

    return headers;
  }

  private async fetchOAuthToken() {
    const auth = asRecord(this.connector.config.auth);
    const tokenUrl = asString(auth.tokenUrl) ?? asString(this.connector.secrets.tokenUrl);
    const clientId = asString(this.connector.secrets.clientId);
    const clientSecret = asString(this.connector.secrets.clientSecret);
    if (!tokenUrl || !clientId || !clientSecret) {
      throw new Error("OAuth2 client credentials require tokenUrl, clientId, and clientSecret");
    }

    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    const scope = asString(auth.scope) ?? asString(this.connector.secrets.scope);
    if (scope) body.set("scope", scope);

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof json.access_token !== "string") {
      throw new Error(`OAuth2 token request failed with ${res.status}`);
    }
    return json.access_token;
  }
}
