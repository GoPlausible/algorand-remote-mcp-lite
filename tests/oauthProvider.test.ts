import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// src/oauth-provider.ts imports WorkerEntrypoint from the Workers runtime, which Node lacks
vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class {} }));

import OAuthProvider from '../src/oauth-provider';
import { OauthHandler } from '../src/oauth-handler';

/**
 * End-to-end tests through the real OAuthProvider (src/oauth-provider.ts) with the real
 * OauthHandler as its default handler: dynamic client registration rules, the token endpoint's
 * redirect_uri binding and PKCE method handling, unwrapToken, and the authenticated /logout.
 * Only the upstream identity provider (Google) is stubbed.
 */

const BASE = 'https://algorandmcplite.goplausible.xyz';
const REDIRECT = 'https://client.example/cb';
const VERIFIER = `${'v'.repeat(43)}erifier-for-pkce-tests-0123456789`;

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
    async list(options: { prefix?: string } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(options.prefix ?? '')).sort().map((name) => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    },
  };
}

const provider = new OAuthProvider({
  apiRoute: '/sse',
  apiHandler: { fetch: async () => new Response('api ok') } as any,
  defaultHandler: OauthHandler as any,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
});

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as any;

let env: any;
let upstreamCalls: { url: string; body: string }[];

beforeEach(() => {
  env = {
    OAUTH_KV: memoryKV(),
    CODE_VERIFIER_KV: memoryKV(),
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
  };
  upstreamCalls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      upstreamCalls.push({ url, body: String(init?.body ?? '') });
      if (url.startsWith('https://accounts.google.com/o/oauth2/token')) return Response.json({ access_token: 'google-access-token' });
      if (url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) {
        return Response.json({ id: 'google-user-1', name: 'Alice', email: 'alice@example.com' });
      }
      if (url.startsWith('https://oauth2.googleapis.com/revoke')) return new Response('', { status: 200 });
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function call(path: string, init: RequestInit = {}, cookies?: Map<string, string>) {
  const headers = new Headers(init.headers);
  if (cookies?.size) headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '));
  const res = await provider.fetch(new Request(`${BASE}${path}`, { ...init, headers }), env, ctx);
  if (cookies) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      if (attrs.some((a) => a.toLowerCase() === 'max-age=0')) cookies.delete(pair.slice(0, eq));
      else cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  return res;
}

function register(redirectUris: unknown[], extra: Record<string, unknown> = {}) {
  return call('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uris: redirectUris, token_endpoint_auth_method: 'none', client_name: 'Test', ...extra }),
  });
}

async function s256(verifier: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Registers a public client and runs the browser part of the flow; returns the issued code. */
async function issueCode(opts: { sendRedirectUri?: boolean } = {}) {
  const clientId = ((await (await register([REDIRECT])).json()) as { client_id: string }).client_id;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    state: 'client-state',
    code_challenge: await s256(VERIFIER),
    code_challenge_method: 'S256',
  });
  if (opts.sendRedirectUri !== false) params.set('redirect_uri', REDIRECT);
  const cookies = new Map<string, string>();
  const consentPage = await (await call(`/authorize?${params}`, {}, cookies)).text();
  const consentToken = consentPage.match(/name="consent_token" value="([0-9a-f]{64})"/)?.[1] as string;
  const toGoogle = await call(
    '/authorize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ consent_token: consentToken, provider: 'google' }).toString(),
    },
    cookies,
  );
  const state = new URL(toGoogle.headers.get('location') as string).searchParams.get('state') as string;
  const back = await call(`/callback?code=google-code&state=${state}`, {}, cookies);
  const location = new URL(back.headers.get('location') as string);
  expect(location.origin + location.pathname).toBe(REDIRECT);
  return { clientId, code: location.searchParams.get('code') as string };
}

function exchange(fields: Record<string, string>) {
  return call('/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', ...fields }).toString(),
  });
}

describe('dynamic client registration', () => {
  it('accepts https and loopback http redirect URIs', async () => {
    for (const uri of [REDIRECT, 'http://localhost:3000/cb', 'http://127.0.0.1:53111/callback', 'http://[::1]:8080/cb']) {
      const res = await register([uri]);
      expect(res.status, uri).toBe(201);
    }
  });

  it('rejects non-loopback http, fragments, private-use and dangerous schemes, and non-URIs', async () => {
    const bad = [
      'http://203.0.113.7/cb',
      'http://client.example/cb',
      'https://client.example/cb#frag',
      'https://client.example/cb#',
      'cursor://anysphere.cursor-mcp/oauth/callback',
      'com.example.app:/oauth',
      'javascript:alert(1)',
      'data:text/html,hi',
      'file:///etc/passwd',
      'not a uri',
      'https://claude.ai@evil.example/cb',
      'https://user:pass@client.example/cb',
    ];
    for (const uri of bad) {
      const res = await register([REDIRECT, uri]);
      expect(res.status, uri).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('invalid_redirect_uri');
    }
    expect([...env.OAUTH_KV.store.keys()].filter((k: string) => k.startsWith('client:'))).toEqual([]);
  });
});

describe('token endpoint', () => {
  it('requires the identical redirect_uri when the authorization request included one', async () => {
    const { clientId, code } = await issueCode();
    const wrong = await exchange({ code, client_id: clientId, code_verifier: VERIFIER, redirect_uri: 'https://client.example/other' });
    expect(wrong.status).toBe(400);
    expect(((await wrong.json()) as { error: string }).error).toBe('invalid_grant');
    const missing = await exchange({ code, client_id: clientId, code_verifier: VERIFIER });
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: string }).error).toBe('invalid_request');

    const ok = await exchange({ code, client_id: clientId, code_verifier: VERIFIER, redirect_uri: REDIRECT });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { access_token: string }).access_token).toBeTruthy();
  });

  it('does not require redirect_uri when the authorization request omitted it', async () => {
    const { clientId, code } = await issueCode({ sendRedirectUri: false });
    const ok = await exchange({ code, client_id: clientId, code_verifier: VERIFIER });
    expect(ok.status).toBe(200);
  });

  it('rejects a wrong PKCE verifier and accepts no method other than S256', async () => {
    const { clientId, code } = await issueCode();
    const wrongVerifier = await exchange({ code, client_id: clientId, code_verifier: `${VERIFIER}x`, redirect_uri: REDIRECT });
    expect(wrongVerifier.status).toBe(400);

    // Grants carrying plain or an unknown method (only reachable through the helper API) must not
    // verify: the challenge itself, as seen in the authorization URL, must not work as the verifier
    for (const [i, method] of ['plain', 'S512'].entries()) {
      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: {
          responseType: 'code', clientId, redirectUri: REDIRECT, scope: [], state: 's',
          codeChallenge: 'the-challenge', codeChallengeMethod: method, redirectUriInRequest: true,
        },
        userId: `u2-${i}`, metadata: {}, scope: [], props: { provider: 'google', accessToken: 't' },
      });
      const oddCode = new URL(redirectTo).searchParams.get('code') as string;
      const res = await exchange({ code: oddCode, client_id: clientId, code_verifier: 'the-challenge', redirect_uri: REDIRECT });
      expect(res.status, method).toBe(400);
      expect(((await res.json()) as { error_description: string }).error_description).toContain('Unsupported');
    }

    const metadata = (await (await call('/.well-known/oauth-authorization-server')).json()) as Record<string, unknown>;
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
  });

  it('rejects a code whose authorization request had no code_challenge (OAuth 2.1 §4.1.3)', async () => {
    const { clientId } = await issueCode();
    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: { responseType: 'code', clientId, redirectUri: REDIRECT, scope: [], state: 's', redirectUriInRequest: true },
      userId: 'u3', metadata: {}, scope: [], props: { provider: 'google', accessToken: 't' },
    });
    const code = new URL(redirectTo).searchParams.get('code') as string;
    const res = await exchange({ code, client_id: clientId, redirect_uri: REDIRECT });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; error_description: string };
    expect(body.error).toBe('invalid_grant');
    expect(body.error_description).toContain('without PKCE');
  });

  it('implements RFC 7009 revocation: 200, only by the owning client', async () => {
    const { clientId, code } = await issueCode();
    const issued = (await (await exchange({ code, client_id: clientId, code_verifier: VERIFIER, redirect_uri: REDIRECT })).json()) as {
      access_token: string;
    };
    const otherClient = ((await (await register([REDIRECT])).json()) as { client_id: string }).client_id;
    const revoke = (fields: Record<string, string>) =>
      call('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
      });

    const foreign = await revoke({ token: issued.access_token, client_id: otherClient });
    expect(foreign.status).toBe(400);
    expect(((await foreign.json()) as { error: string }).error).toBe('invalid_grant');
    expect(await env.OAUTH_PROVIDER.unwrapToken(issued.access_token)).not.toBeNull();

    expect((await revoke({ token: issued.access_token, client_id: clientId })).status).toBe(200);
    expect(await env.OAUTH_PROVIDER.unwrapToken(issued.access_token)).toBeNull();
    expect((await revoke({ token: 'unknown:token:value', client_id: clientId })).status).toBe(200);

    const metadata = (await (await call('/.well-known/oauth-authorization-server')).json()) as Record<string, unknown>;
    expect(metadata.revocation_endpoint_auth_methods_supported).toEqual(['client_secret_basic', 'client_secret_post', 'none']);
  });
});

describe('redirect URIs at sign-in', () => {
  it('holds clients registered under older rules to the current redirect URI rules', async () => {
    const legacy = { clientId: 'legacy-client', redirectUris: ['cursor://anysphere.cursor-mcp/oauth/callback', 'http://10.0.0.5/cb'], tokenEndpointAuthMethod: 'none' };
    env.OAUTH_KV.store.set('client:legacy-client', JSON.stringify(legacy));
    for (const uri of legacy.redirectUris) {
      const params = new URLSearchParams({ response_type: 'code', client_id: 'legacy-client', redirect_uri: uri, code_challenge: 'c', code_challenge_method: 'S256' });
      expect((await call(`/authorize?${params}`)).status, uri).toBe(400);
    }
  });

  it('shows an international redirect host in punycode on the consent page', async () => {
    const idn = 'https://clаude.ai/api/mcp/auth_callback'; // Cyrillic "а"
    const clientId = ((await (await register([idn])).json()) as { client_id: string }).client_id;
    const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: idn, code_challenge: 'c', code_challenge_method: 'S256' });
    const html = await (await call(`/authorize?${params}`)).text();
    expect(html).toContain('<strong>xn--clude-5ve.ai</strong>');
    expect(html).not.toContain('clаude.ai');
  });
});

describe('unwrapToken and /logout', () => {
  async function tokens() {
    const { clientId, code } = await issueCode();
    const res = await exchange({ code, client_id: clientId, code_verifier: VERIFIER, redirect_uri: REDIRECT });
    return (await res.json()) as { access_token: string; refresh_token: string };
  }

  it('unwrapToken returns the owner and props of a valid token, and null otherwise', async () => {
    const { access_token } = await tokens();
    const summary = await env.OAUTH_PROVIDER.unwrapToken(access_token);
    expect(summary.userId).toBe('google-user-1');
    expect(summary.props.email).toBe('alice@example.com');
    expect(summary.props.accessToken).toBe('google-access-token');
    expect(await env.OAUTH_PROVIDER.unwrapToken('nope')).toBeNull();
    expect(await env.OAUTH_PROVIDER.unwrapToken(`${access_token}x`)).toBeNull();

    // Expired
    const key = [...env.OAUTH_KV.store.keys()].find((k: string) => k.startsWith('token:')) as string;
    const record = JSON.parse(env.OAUTH_KV.store.get(key));
    env.OAUTH_KV.store.set(key, JSON.stringify({ ...record, expiresAt: 1 }));
    expect(await env.OAUTH_PROVIDER.unwrapToken(access_token)).toBeNull();
  });

  it('refuses unauthenticated, query-parameter and GET requests without touching anything', async () => {
    const { access_token } = await tokens();
    const before = [...env.OAUTH_KV.store.keys()].sort();
    const clientKey = before.find((k) => k.startsWith('client:')) as string;
    const clientId = clientKey.slice('client:'.length);

    // RFC 6750 §3: no credentials -> challenge without an error code; bad token -> invalid_token
    const none = await call('/logout', { method: 'POST' });
    expect(none.status).toBe(401);
    expect(none.headers.get('www-authenticate')).toBe('Bearer realm="OAuth"');
    const bad = await call('/logout', { method: 'POST', headers: { Authorization: 'Bearer nope' } });
    expect(bad.status).toBe(401);
    expect(bad.headers.get('www-authenticate')).toContain('error="invalid_token"');
    // The old unauthenticated form: query parameters only
    const legacy = await call(`/logout?provider=google&clientId=${clientId}&email=x&userId=g`, { method: 'POST' });
    expect(legacy.status).toBe(401);
    expect(legacy.headers.get('www-authenticate')).toBe('Bearer realm="OAuth"');
    // GET is not a logout
    const get = await call('/logout', { headers: { Authorization: `Bearer ${access_token}` } });
    expect(get.status).not.toBe(200);

    expect([...env.OAUTH_KV.store.keys()].sort()).toEqual(before);
  });

  it("revokes the caller's own grant, its tokens and the upstream token, and nothing else", async () => {
    const mine = await tokens();
    const other = await tokens(); // a second session (another grant) must survive
    const otherGrant = (await env.OAUTH_PROVIDER.unwrapToken(other.access_token)).grantId;
    const myGrant = (await env.OAUTH_PROVIDER.unwrapToken(mine.access_token)).grantId;
    const clientsBefore = [...env.OAUTH_KV.store.keys()].filter((k: string) => k.startsWith('client:'));

    // The auth scheme is case-insensitive
    const res = await call('/logout', { method: 'POST', headers: { Authorization: `bearer ${mine.access_token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, upstreamRevoked: true });
    expect(upstreamCalls.some((c) => c.url.startsWith('https://oauth2.googleapis.com/revoke') && c.body.includes('google-access-token'))).toBe(true);

    const keys = [...env.OAUTH_KV.store.keys()] as string[];
    expect(keys.some((k) => k.includes(`:${myGrant}`))).toBe(false);
    expect(keys.some((k) => k.includes(`:${otherGrant}`))).toBe(true);
    expect(keys.filter((k) => k.startsWith('client:'))).toEqual(clientsBefore);

    // The revoked token no longer works, the other session still does
    expect(await env.OAUTH_PROVIDER.unwrapToken(mine.access_token)).toBeNull();
    expect(await env.OAUTH_PROVIDER.unwrapToken(other.access_token)).not.toBeNull();
    expect((await call('/logout', { method: 'POST', headers: { Authorization: `Bearer ${mine.access_token}` } })).status).toBe(401);
    expect((await call('/sse', { headers: { Authorization: `Bearer ${mine.access_token}` } })).status).toBe(401);
    expect((await call('/sse', { headers: { Authorization: `Bearer ${other.access_token}` } })).status).toBe(200);
  });
});
