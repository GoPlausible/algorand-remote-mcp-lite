/**
 * Browser-bound state for the OAuth flows this Worker runs.
 *
 * Two hops need protection:
 *
 * 1. Consent (GET /authorize renders the form, POST /authorize submits it).
 *    The validated authorization request is stored server-side under a random consent token.
 *    The form carries the token and a __Host- cookie carries the same token, so only the
 *    browser that was shown the form can submit it: a cross-site auto-submitted POST arrives
 *    without the SameSite=Lax cookie and is refused (RFC 6749 §10.12). The client id and
 *    redirect URI can no longer be swapped in the form, because they are never read from it.
 *
 * 2. Upstream login (redirect to Google / GitHub / LinkedIn / X, back to GET /callback).
 *    The `state` sent upstream is a random value; the flow data (provider, validated
 *    authorization request, X PKCE verifier) is stored server-side under it, and a __Host-
 *    cookie binds it to the browser. /callback accepts the response only when the state
 *    exists, matches the cookie and has not been used before (RFC 6749 §10.12, RFC 9700 §4.7).
 *
 * Both records live in CODE_VERIFIER_KV for FLOW_TTL_SECONDS and are deleted on first use.
 */
import type { AuthRequest } from "../oauth-provider";

export const OAUTH_PROVIDERS = ["google", "github", "linkedin", "twitter"] as const;
export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];

// Cookie name prefixes. Each flow gets its own cookie (prefix + first 16 hex characters of its
// token), so two sign-ins running in the same browser do not overwrite each other's binding.
export const CONSENT_COOKIE = "__Host-mcp-consent";
export const OAUTH_STATE_COOKIE = "__Host-mcp-oauth-state";
export const FLOW_TTL_SECONDS = 600;

export function consentCookieName(token: string): string {
	return `${CONSENT_COOKIE}-${token.slice(0, 16)}`;
}

export function stateCookieName(state: string): string {
	return `${OAUTH_STATE_COOKIE}-${state.slice(0, 16)}`;
}

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export interface UpstreamFlowState {
	provider: OAuthProviderName;
	authReqInfo: AuthRequest;
	/** PKCE verifier for providers that need one (X). Never leaves the server. */
	codeVerifier?: string;
}

export function isOAuthProvider(value: unknown): value is OAuthProviderName {
	return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** 32 random bytes as 64 lower-case hex characters. */
export function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("Cookie");
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		const eq = trimmed.indexOf("=");
		if (eq > 0 && trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
	}
	return undefined;
}

export function flowCookie(name: string, value: string): string {
	return `${name}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${FLOW_TTL_SECONDS}`;
}

export function clearFlowCookie(name: string): string {
	return `${name}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** True when `submitted` is a well-formed token equal to the value of its own flow cookie. */
function matchesCookie(
	request: Request,
	cookieNameFor: (token: string) => string,
	submitted: unknown,
): submitted is string {
	if (typeof submitted !== "string" || !TOKEN_PATTERN.test(submitted)) return false;
	const fromCookie = readCookie(request, cookieNameFor(submitted));
	return fromCookie !== undefined && timingSafeEqual(submitted, fromCookie);
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Returns why a redirect URI is not acceptable, or null if it is. Applied at client
 * registration and again whenever a redirect URI is used, so clients registered under older
 * rules are held to the same standard.
 * - RFC 6749 §3.1.2: an absolute URI without a fragment component.
 * - MCP Authorization, Communication Security: "All redirect URIs MUST be either localhost or
 *   use HTTPS". Private-use schemes (RFC 8252 §7.1) are deliberately not accepted (decision
 *   2026-11-09), so only https:, or http: on a loopback host, pass.
 * - No user information: "https://claude.ai@evil.example/" would read as claude.ai on the
 *   consent page while sending the code to evil.example.
 */
export function redirectUriProblem(uri: string): string | null {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return "must be an absolute URI";
	}
	if (uri.includes("#")) return "must not contain a fragment";
	if (url.username || url.password) return "must not contain user information";
	if (url.protocol === "https:") return null;
	if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return null;
	return "must use https, or http on localhost, 127.0.0.1 or [::1]";
}

/**
 * RFC 6749 §3.1.2.3: the redirect URI must be one the client registered. It may be omitted
 * only when the client registered exactly one. Returns the URI to use, or null if invalid.
 */
export function resolveRedirectUri(requested: string, registered: string[]): string | null {
	if (requested) return registered.includes(requested) ? requested : null;
	return registered.length === 1 ? registered[0] : null;
}

/** Stores a validated authorization request for the consent form. */
export async function createConsent(
	kv: KVNamespace,
	authReqInfo: AuthRequest,
): Promise<{ token: string; setCookie: string }> {
	const token = randomToken();
	await kv.put(`consent:${token}`, JSON.stringify(authReqInfo), { expirationTtl: FLOW_TTL_SECONDS });
	return { token, setCookie: flowCookie(consentCookieName(token), token) };
}

/**
 * Returns the stored authorization request when the submitted consent token matches this
 * browser's consent cookie and has not been used yet; otherwise null. One-time use.
 */
export async function consumeConsent(
	kv: KVNamespace,
	request: Request,
	submittedToken: unknown,
): Promise<AuthRequest | null> {
	if (!matchesCookie(request, consentCookieName, submittedToken)) return null;
	const key = `consent:${submittedToken}`;
	const stored = await kv.get<AuthRequest>(key, { type: "json" });
	if (!stored) return null;
	await kv.delete(key);
	return stored;
}

/** Stores the upstream login flow and returns the `state` to send upstream plus its cookie. */
export async function createUpstreamState(
	kv: KVNamespace,
	flow: UpstreamFlowState,
): Promise<{ state: string; setCookie: string }> {
	const state = randomToken();
	await kv.put(`oauth-state:${state}`, JSON.stringify(flow), { expirationTtl: FLOW_TTL_SECONDS });
	return { state, setCookie: flowCookie(stateCookieName(state), state) };
}

/**
 * Returns the stored flow when the `state` returned by the provider matches this browser's
 * state cookie and has not been used yet; otherwise null. One-time use.
 */
export async function consumeUpstreamState(
	kv: KVNamespace,
	request: Request,
	state: string | undefined,
): Promise<UpstreamFlowState | null> {
	if (!matchesCookie(request, stateCookieName, state)) return null;
	const key = `oauth-state:${state}`;
	const stored = await kv.get<UpstreamFlowState>(key, { type: "json" });
	if (!stored || !isOAuthProvider(stored.provider) || !stored.authReqInfo) return null;
	await kv.delete(key);
	return stored;
}
