// SPDX-License-Identifier: Apache-2.0
export type JsonObject = Record<string, unknown>;
export interface Capabilities { product: string; version: string; api_version: string; authentication: string[]; features: string[] }
export interface Domain { id: string; name: string; mode: 'registry'|'consolidation'|'centralized'|'coexistence'; schema_version: number; definition: JsonObject }
export interface MasterVersion { version: number; values: JsonObject; provenance: JsonObject; status: string }
export interface Entity { id: string; stable_key: string; version: number; approval_state: string; master?: MasterVersion }
export interface ReviewTask { id: string; kind: string; status: string; payload: JsonObject; bound_version?: number }
export interface Page<T> { items: T[]; next_cursor?: string }
export type CredentialHook = () => string | undefined | Promise<string | undefined>;

export class RecordlaneError extends Error {
  constructor(public status: number, message: string, public correlationId?: string) { super(message); this.name = 'RecordlaneError'; }
}
export class UnauthorizedError extends RecordlaneError { override name = 'UnauthorizedError'; }
export class ForbiddenError extends RecordlaneError { override name = 'ForbiddenError'; }
export class ConflictError extends RecordlaneError { override name = 'ConflictError'; }

export interface ClientOptions {
  token?: string; credentialHook?: CredentialHook; timeoutMs?: number; retries?: number;
  demoUser?: string; demoRoles?: string; fetch?: typeof globalThis.fetch;
}

const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export class Recordlane {
  private readonly fetcher: typeof globalThis.fetch;
  constructor(private readonly baseUrl: string, private readonly options: ClientOptions = {}) { this.fetcher = options.fetch ?? globalThis.fetch; }
  private async headers(idempotencyKey?: string): Promise<HeadersInit> {
    const token = this.options.credentialHook ? await this.options.credentialHook() : this.options.token;
    const headers: Record<string,string> = {'content-type':'application/json'};
    if (token) headers.authorization = `Bearer ${token}`;
    if (this.options.demoUser) { headers['x-recordlane-user'] = this.options.demoUser; headers['x-recordlane-role'] = this.options.demoRoles ?? 'read_only'; headers['x-recordlane-workspace']='demo'; }
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    return headers;
  }
  async request<T>(method: string, path: string, init: {body?: unknown; idempotencyKey?: string} = {}): Promise<T> {
    const safe = ['GET','HEAD'].includes(method.toUpperCase()) || Boolean(init.idempotencyKey);
    const retries = this.options.retries ?? 2;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000);
      try {
        const response = await this.fetcher(`${this.baseUrl.replace(/\/$/,'')}/api/v1${path}`, {method, headers: await this.headers(init.idempotencyKey), body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: controller.signal});
        if (!response.ok) {
          const payload = await response.json().catch(() => ({detail: response.statusText})) as {detail?: unknown};
          const type = response.status === 401 ? UnauthorizedError : response.status === 403 ? ForbiddenError : response.status === 409 ? ConflictError : RecordlaneError;
          throw new type(response.status, String(payload.detail ?? response.statusText), response.headers.get('x-correlation-id') ?? undefined);
        }
        return (response.status === 204 ? undefined : await response.json()) as T;
      } catch (error) {
        if (error instanceof RecordlaneError || !safe || attempt === retries) throw error;
        await sleep(100 * 2 ** attempt);
      } finally { clearTimeout(timer); }
    }
    throw new Error('unreachable');
  }
  capabilities = () => this.request<Capabilities>('GET', '/capabilities');
  domains = () => this.request<Domain[]>('GET', '/domains');
  entities = () => this.request<Entity[]>('GET', '/entities');
  reviewTasks = () => this.request<ReviewTask[]>('GET', '/review-tasks');
  decide = (taskId: string, decision: 'approve'|'reject'|'link'|'cannot_link', idempotencyKey: string) => this.request<JsonObject>('POST', `/review-tasks/${taskId}/decision`, {body:{decision}, idempotencyKey});
  relayPublication = (idempotencyKey: string) => this.request<JsonObject>('POST', '/operations/relay', {idempotencyKey});
  async *paginate<T>(path: string): AsyncGenerator<T> {
    let cursor: string | undefined;
    do {
      const separator=path.includes('?')?'&':'?';
      const value = await this.request<T[]|Page<T>>('GET', `${path}${separator}page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      const page: Page<T> = Array.isArray(value) ? {items:value} : value;
      yield* page.items; cursor = page.next_cursor;
    } while (cursor);
  }
}
