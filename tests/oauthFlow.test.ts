import { afterEach, describe, expect, it, vi } from 'vitest';
import { OauthHandler } from '../src/oauth-handler';
import {
  consentCookieName,
  consumeConsent,
  consumeUpstreamState,
  createConsent,
  createUpstreamState,
  randomToken,
  readCookie,
  resolveRedirectUri,
  stateCookieName,
} from '../src/utils/oauthFlow';

/**
 * Tests for the browser-bound OAuth flow state (src/utils/oauthFlow.ts) and the
 * /authorize and /callback routes in src/oauth-handler.ts.
 */

const BASE = 'https://algorandmcplite.goplausible.xyz';
const REDIRECT = 'https://client.example/cb';
const CLIENT = {
  clientId: 'mcp-client',
  clientName: 'Test MCP Client',
  redirectUris: [REDIRECT],
  tokenEndpointAuthMethod: 'none',
};

function memoryKV() {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string, opts?: unknown) {
      const value = store.get(key);
      if (value === undefined) return null;
      const json = opts === 'json' || (typeof opts === 'object' && opts !== null && (opts as { type?: string }).type === 'json');
      return json ? JSON.parse(value) : value;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function makeEnv() {
  const completeAuthorization = vi.fn(async (opts: { request: { redirectUri: string; state: string } }) => ({
    redirectTo: `${opts.request.redirectUri}?code=issued-code&state=${opts.request.state}`,
  }));
  const OAUTH_PROVIDER = {
    async lookupClient(id: string) {
      return id === CLIENT.clientId ? CLIENT : null;
    },
    // Plain parsing only (no redirect_uri check), to prove the handler validates on its own.
    async parseAuthRequest(request: Request) {
      const url = new URL(request.url);
      return {
        responseType: url.searchParams.get('response_type') || '',
        clientId: url.searchParams.get('client_id') || '',
        redirectUri: url.searchParams.get('redirect_uri') || '',
        scope: (url.searchParams.get('scope') || '').split(' ').filter(Boolean),
        state: url.searchParams.get('state') || '',
        codeChallenge: url.searchParams.get('code_challenge') || undefined,
        codeChallengeMethod: url.searchParams.get('code_challenge_method') || 'plain',
      };
    },
    completeAuthorization,
  };
  return {
    env: {
      CODE_VERIFIER_KV: memoryKV(),
      OAUTH_PROVIDER,
      COOKIE_ENCRYPTION_KEY: 'test-cookie-key-0123456789abcdef',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      TWITTER_CLIENT_ID: 'x-id',
      TWITTER_CLIENT_SECRET: 'x-secret',
    },
    completeAuthorization,
  };
}

/** Minimal cookie jar: applies Set-Cookie headers from responses. */
class Jar {
  cookies = new Map<string, string>();
  take(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (attrs.some((a) => a.toLowerCase() === 'max-age=0')) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function authorizeUrl(params: Record<string, string> = {}) {
  const qs = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT.clientId,
    redirect_uri: REDIRECT,
    state: 'client-state',
    code_challenge: 'client-challenge',
    code_challenge_method: 'S256',
    ...params,
  });
  return `${BASE}/authorize?${qs}`;
}

async function request(env: object, url: string, init: RequestInit = {}, jar?: Jar) {
  const headers = new Headers(init.headers);
  if (jar?.cookies.size) headers.set('Cookie', jar.header());
  const res = await OauthHandler.request(url, { ...init, headers }, env);
  return jar ? jar.take(res) : res;
}

function postConsent(env: object, fields: Record<string, string>, jar?: Jar) {
  return request(
    env,
    `${BASE}/authorize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    },
    jar,
  );
}

function consentTokenFrom(html: string): string {
  const match = html.match(/name="consent_token" value="([0-9a-f]{64})"/);
  if (!match) throw new Error('consent_token not found in form');
  return match[1];
}

async function openConsent(env: object, jar: Jar, params: Record<string, string> = {}) {
  const res = await request(env, authorizeUrl(params), {}, jar);
  return consentTokenFrom(await res.text());
}

function stubUpstream() {
  const calls: { url: string; body: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push({ url, body: String(init?.body ?? '') });
      if (url.startsWith('https://accounts.google.com/o/oauth2/token') || url.startsWith('https://api.x.com/2/oauth2/token')) {
        return Response.json({ access_token: 'upstream-access-token' });
      }
      if (url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) {
        return Response.json({ id: 'google-user', name: 'Alice', email: 'alice@example.com' });
      }
      if (url.startsWith('https://api.x.com/2/users/me')) {
        return Response.json({ data: { id: 'x-user', name: 'Alice', username: 'alice' } });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('oauthFlow helpers', () => {
  it('makes 64-hex tokens and reads cookies by exact name', () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{64}$/);
    expect(randomToken()).not.toBe(randomToken());
    const req = new Request(BASE, { headers: { Cookie: 'a=1; __Host-x=xyz; y__Host-x=nope' } });
    expect(readCookie(req, '__Host-x')).toBe('xyz');
    expect(readCookie(req, 'missing')).toBeUndefined();
  });

  it('resolves redirect URIs per RFC 6749 §3.1.2.3', () => {
    expect(resolveRedirectUri(REDIRECT, [REDIRECT])).toBe(REDIRECT);
    expect(resolveRedirectUri('https://attacker.example/cb', [REDIRECT])).toBeNull();
    expect(resolveRedirectUri('', [REDIRECT])).toBe(REDIRECT);
    expect(resolveRedirectUri('', [REDIRECT, 'https://client.example/other'])).toBeNull();
    expect(resolveRedirectUri('', [])).toBeNull();
  });

  it('releases a consent record once, and only with its own matching cookie', async () => {
    const kv = memoryKV() as unknown as KVNamespace;
    const authReq = { responseType: 'code', clientId: 'c', redirectUri: REDIRECT, scope: [], state: 's' };
    const { token, setCookie } = await createConsent(kv, authReq);
    expect(setCookie).toContain(`${consentCookieName(token)}=${token}`);
    expect(setCookie).toMatch(/^__Host-/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('SameSite=Lax');

    const cookie = (value: string) => new Request(BASE, { headers: { Cookie: `${consentCookieName(token)}=${value}` } });
    expect(await consumeConsent(kv, new Request(BASE), token)).toBeNull();
    expect(await consumeConsent(kv, cookie(`${token.slice(0, 16)}${'0'.repeat(48)}`), token)).toBeNull();
    expect(await consumeConsent(kv, cookie(token), 'not-a-token')).toBeNull();
    expect(await consumeConsent(kv, cookie(token), token)).toEqual(authReq);
    expect(await consumeConsent(kv, cookie(token), token)).toBeNull();
  });

  it('releases an upstream state once, and only with its own matching cookie', async () => {
    const kv = memoryKV() as unknown as KVNamespace;
    const flow = {
      provider: 'google' as const,
      authReqInfo: { responseType: 'code', clientId: 'c', redirectUri: REDIRECT, scope: [], state: 's' },
    };
    const { state, setCookie } = await createUpstreamState(kv, flow);
    expect(setCookie).toContain(`${stateCookieName(state)}=${state}`);
    const rightCookie = new Request(BASE, { headers: { Cookie: `${stateCookieName(state)}=${state}` } });
    expect(await consumeUpstreamState(kv, new Request(BASE), state)).toBeNull();
    expect(await consumeUpstreamState(kv, rightCookie, undefined)).toBeNull();
    expect(await consumeUpstreamState(kv, rightCookie, state)).toEqual(flow);
    expect(await consumeUpstreamState(kv, rightCookie, state)).toBeNull();
  });
});

describe('GET /authorize', () => {
  it('renders consent with a consent token bound to a cookie, safe headers and a submit guard', async () => {
    const { env } = makeEnv();
    const jar = new Jar();
    const res = await request(env, authorizeUrl(), {}, jar);
    expect(res.status).toBe(200);
    const html = await res.text();
    const token = consentTokenFrom(html);
    expect(jar.cookies.get(consentCookieName(token))).toBe(token);
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(html).toContain('this.dataset.sent');
    expect(html).not.toContain('Website:');
  });

  it('rejects unregistered redirect URIs, unknown clients and non-code response types', async () => {
    const { env } = makeEnv();
    expect((await request(env, authorizeUrl({ redirect_uri: 'https://attacker.example/cb' }))).status).toBe(400);
    expect((await request(env, authorizeUrl({ client_id: 'unknown' }))).status).toBe(400);
    expect((await request(env, authorizeUrl({ client_id: '' }))).status).toBe(400);
    expect((await request(env, authorizeUrl({ response_type: 'token' }))).status).toBe(400);
    expect(env.CODE_VERIFIER_KV.store.size).toBe(0);
  });

  it('uses the single registered redirect URI when none is given', async () => {
    const { env } = makeEnv();
    const url = new URL(authorizeUrl());
    url.searchParams.delete('redirect_uri');
    const res = await request(env, url.toString());
    expect(res.status).toBe(200);
    const stored = [...env.CODE_VERIFIER_KV.store.values()].map((v) => JSON.parse(v));
    expect(stored[0].redirectUri).toBe(REDIRECT);
  });

  it('asks for consent again even after an earlier approval in the same browser', async () => {
    const { env } = makeEnv();
    const browser = new Jar();
    const token = await openConsent(env, browser);
    await postConsent(env, { consent_token: token, provider: 'google' }, browser);
    const again = await request(env, authorizeUrl(), {}, browser);
    expect(again.status).toBe(200);
    expect(again.headers.get('location')).toBeNull();
  });
});

describe('POST /authorize', () => {
  it('refuses a submission without the consent cookie (cross-site POST)', async () => {
    const { env } = makeEnv();
    const token = await openConsent(env, new Jar());
    // Attacker page auto-submits the form: the SameSite=Lax cookie is not sent
    const res = await postConsent(env, { consent_token: token, provider: 'google' });
    expect(res.status).toBe(403);
    expect(res.headers.get('location')).toBeNull();
  });

  it('refuses a token from another browser and an unknown provider', async () => {
    const { env } = makeEnv();
    const attackerToken = await openConsent(env, new Jar());
    const victim = new Jar();
    await openConsent(env, victim);
    expect((await postConsent(env, { consent_token: attackerToken, provider: 'google' }, victim)).status).toBe(403);

    const browser = new Jar();
    const token = await openConsent(env, browser);
    expect((await postConsent(env, { consent_token: token, provider: 'evil' }, browser)).status).toBe(403);
  });

  it('accepts the form from the browser that saw it, once, and starts the upstream flow', async () => {
    const { env } = makeEnv();
    const browser = new Jar();
    const token = await openConsent(env, browser);
    const consentCookie = browser.cookies.get(consentCookieName(token)) as string;

    const res = await postConsent(env, { consent_token: token, provider: 'google' }, browser);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location') as string);
    expect(location.origin).toBe('https://accounts.google.com');
    const state = location.searchParams.get('state') as string;
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(browser.cookies.get(stateCookieName(state))).toBe(state);
    expect(browser.cookies.has(consentCookieName(token))).toBe(false);
    expect(res.headers.getSetCookie().length).toBe(2);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('mcp-'))).toBe(false);

    // Replaying the same form submission fails
    const replay = new Jar();
    replay.cookies.set(consentCookieName(token), consentCookie);
    expect((await postConsent(env, { consent_token: token, provider: 'google' }, replay)).status).toBe(403);
  });

  it('lets two sign-ins run in the same browser without breaking each other', async () => {
    const { env } = makeEnv();
    const browser = new Jar();
    const first = await openConsent(env, browser);
    const second = await openConsent(env, browser);
    expect((await postConsent(env, { consent_token: first, provider: 'google' }, browser)).status).toBe(302);
    expect((await postConsent(env, { consent_token: second, provider: 'google' }, browser)).status).toBe(302);
  });
});

describe('GET /callback', () => {
  async function startGoogleFlow(env: object, browser = new Jar()) {
    const token = await openConsent(env, browser);
    const res = await postConsent(env, { consent_token: token, provider: 'google' }, browser);
    const state = new URL(res.headers.get('location') as string).searchParams.get('state') as string;
    return { browser, state };
  }

  it("refuses a state without its cookie, or with a forged cookie value", async () => {
    const { env, completeAuthorization } = makeEnv();
    const calls = stubUpstream();
    const { state } = await startGoogleFlow(env);
    const forged = new Jar();
    forged.cookies.set(stateCookieName(state), `${state.slice(0, 16)}${'0'.repeat(48)}`);
    expect((await request(env, `${BASE}/callback?code=c&state=${state}`)).status).toBe(400);
    expect((await request(env, `${BASE}/callback?code=c&state=${state}`, {}, forged)).status).toBe(400);
    expect(calls.length).toBe(0);
    expect(completeAuthorization).not.toHaveBeenCalled();
  });

  it('completes the flow for the right browser to the registered redirect URI, once', async () => {
    const { env, completeAuthorization } = makeEnv();
    stubUpstream();
    const { browser, state } = await startGoogleFlow(env);

    const res = await request(env, `${BASE}/callback?code=upstream-code&state=${state}`, {}, browser);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${REDIRECT}?code=issued-code&state=client-state`);
    expect(browser.cookies.has(stateCookieName(state))).toBe(false);
    expect(completeAuthorization).toHaveBeenCalledOnce();
    const opts = completeAuthorization.mock.calls[0][0] as { request: { redirectUri: string; clientId: string } };
    expect(opts.request.redirectUri).toBe(REDIRECT);
    expect(opts.request.clientId).toBe(CLIENT.clientId);

    // Replay with the same state and cookie fails
    browser.cookies.set(stateCookieName(state), state);
    expect((await request(env, `${BASE}/callback?code=upstream-code&state=${state}`, {}, browser)).status).toBe(400);
  });

  it('completes two concurrent flows in the same browser', async () => {
    const { env } = makeEnv();
    stubUpstream();
    const browser = new Jar();
    const a = await startGoogleFlow(env, browser);
    const b = await startGoogleFlow(env, browser);
    expect((await request(env, `${BASE}/callback?code=x&state=${a.state}`, {}, browser)).status).toBe(302);
    expect((await request(env, `${BASE}/callback?code=y&state=${b.state}`, {}, browser)).status).toBe(302);
  });

  it('keeps the X PKCE verifier per flow and sends it with the token request', async () => {
    const { env } = makeEnv();
    const calls = stubUpstream();
    const browser = new Jar();
    const token = await openConsent(env, browser);
    const res = await postConsent(env, { consent_token: token, provider: 'twitter' }, browser);
    const location = new URL(res.headers.get('location') as string);
    const challenge = location.searchParams.get('code_challenge') as string;
    const state = location.searchParams.get('state') as string;

    const done = await request(env, `${BASE}/callback?code=x-code&state=${state}`, {}, browser);
    expect(done.status).toBe(302);
    const tokenCall = calls.find((c) => c.url.startsWith('https://api.x.com/2/oauth2/token'));
    const verifier = new URLSearchParams(tokenCall?.body).get('code_verifier') as string;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const expected = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(challenge).toBe(expected);
  });
});
