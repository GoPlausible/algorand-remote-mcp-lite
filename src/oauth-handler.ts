import { Hono } from "hono";
import { getLogo } from "./logoUrl.js";
import type { AuthRequest, OAuthHelpers } from "./oauth-provider";

import type { Env, Props } from "./types";
import { handleImageProxyRequest, IMAGE_PROXY_PATH } from "./utils/imageProxy";
import {
	clearFlowCookie,
	consumeUpstreamState,
	createConsent,
	isOAuthProvider,
	redirectUriProblem,
	resolveRedirectUri,
	stateCookieName,
} from "./utils/oauthFlow";
import {
	fetchUpstreamAuthToken,
	parseRedirectApproval,
	redirectToProvider,
	renderApprovalDialog,
	revokeUpstreamToken,
} from "./workers-oauth-utils";
// import { auth } from "@modelcontextprotocol/sdk/client/auth.js";

// Extend the Env type to include our OAuth configuration
interface OAuthEnv {
	OAUTH_PROVIDER: OAuthHelpers;
	CODE_VERIFIER_KV: KVNamespace; // KV namespace for PKCE code verifiers
	OAUTH_KV: KVNamespace; // KV namespace for OAuth client data
	COOKIE_ENCRYPTION_KEY: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	TWITTER_CLIENT_ID: string;
	TWITTER_CLIENT_SECRET: string;
	LINKEDIN_CLIENT_ID: string;
	LINKEDIN_CLIENT_SECRET: string;
	HOSTED_DOMAIN?: string;
}

const app = new Hono<{ Bindings: Env & OAuthEnv }>();

/**
 * OAuth authorization request from an MCP client.
 * Validates the client, its redirect URI (RFC 6749 §3.1.2) and PKCE, then renders the consent
 * form. Errors are shown as a 400 page and never redirected back to the client
 * (RFC 9700 §4.11.2, MCP "Open Redirection"; decision 2026-11-09).
 */
app.get("/authorize", async (c) => {
	console.log("[OAUTH_HANDLER] Received OAuth authorization request");
	let authReqInfo: AuthRequest;
	try {
		// Validates client_id and redirect_uri, and rejects response_type=token (implicit flow is off)
		authReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	} catch (e) {
		console.warn("[OAUTH_HANDLER] Rejected authorization request:", e instanceof Error ? e.message : e);
		return c.text("Invalid authorization request", 400);
	}
	const client = authReqInfo.clientId
		? await c.env.OAUTH_PROVIDER.lookupClient(authReqInfo.clientId)
		: null;
	if (!client) {
		console.error("[OAUTH_HANDLER] Invalid OAuth request: unknown or missing client_id");
		return c.text("Invalid request", 400);
	}
	if (authReqInfo.responseType !== "code") {
		return c.text("Unsupported response_type", 400);
	}
	const redirectUri = resolveRedirectUri(authReqInfo.redirectUri, client.redirectUris);
	// Also holds clients registered under older rules to the current redirect URI rules
	if (!redirectUri || redirectUriProblem(redirectUri)) {
		return c.text("Invalid redirect_uri", 400);
	}
	// PKCE is required for every client (OAuth 2.1 §4.1.2.1: public clients always; other clients
	// unless code injection is mitigated another way, which this server has no other means for).
	// Only S256 is accepted (decision 2026-11-10): RFC 7636 §4.2 makes it the mandatory method,
	// RFC 9700 §2.1.1 calls it the only one that does not expose the verifier, and RFC 7636
	// §4.4.1 allows refusing others. A missing method means "plain" (§4.3), so it is refused too.
	if (!authReqInfo.codeChallenge) {
		return c.text("Invalid request: code_challenge is required (PKCE)", 400);
	}
	if (authReqInfo.codeChallengeMethod !== "S256") {
		return c.text("Invalid request: code_challenge_method must be S256", 400);
	}
	authReqInfo = {
		...authReqInfo,
		redirectUri,
		// RFC 6749 §4.1.3: the token request must repeat redirect_uri if this request included it
		redirectUriInRequest: authReqInfo.redirectUri !== "",
	};
	const clientId = authReqInfo.clientId;
	console.log("[OAUTH_HANDLER] Validated OAuth request for Client ID:", clientId);

	// Remembered approvals are parked (see parseRedirectApproval in workers-oauth-utils.ts):
	// consent is asked on every authorization.
	// const { approved, provider } = await clientIdAlreadyApproved(c.req.raw, clientId, c.env.COOKIE_ENCRYPTION_KEY || "");
	// if (approved && isOAuthProvider(provider)) {
	// 	return redirectToProvider(c, provider, authReqInfo);
	// }
	console.log(`[OAUTH_HANDLER] Rendering approval dialog for Client ID ${clientId}`);

	const consent = await createConsent(c.env.CODE_VERIFIER_KV, authReqInfo);
	return renderApprovalDialog(c.req.raw, {
		client,
		server: {
			description:
				"Algorand MCP Remote Server Authentication using OAuth 2 protocol. Supports Google, GitHub, Twitter, and LinkedIn.",
			name: "Algorand Remote MCP OAuth",
			// Using the GoPlausible logo as a base64 data URL
			//    `base64 -i src/assets/goPlausible-logo-type-h.png | pbcopy` (on macOS)
			//    `base64 -w 0 src/assets/goPlausible-logo-type-h.png | xclip -selection clipboard` (on Linux)
			logo: getLogo(),
		},

		consentToken: consent.token,
		setCookie: consent.setCookie,
		authReqInfo,
	});
});

/**
 * Consent form submission.
 * Accepted only from the browser that was shown the form (consent token + cookie, one-time);
 * the authorization request comes from the server-side record, never from the form.
 */
app.post("/authorize", async (c) => {
	let approval: Awaited<ReturnType<typeof parseRedirectApproval>>;
	try {
		approval = await parseRedirectApproval(c.req.raw, c.env);
	} catch (e) {
		console.warn("[OAUTH_HANDLER] Rejected consent submission:", e instanceof Error ? e.message : e);
		return c.text(
			"This sign-in request has expired or was not started in this browser. Please start the connection again from your MCP client.",
			403,
		);
	}
	console.log(
		`[OAUTH_HANDLER] Consent given for Client ID ${approval.authReqInfo.clientId} with provider ${approval.provider}`,
	);
	return redirectToProvider(c, approval.provider, approval.authReqInfo, approval.setCookies);
});

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback from OAuth providers after user authentication.
 * It exchanges the temporary code for an access token, then stores some
 * user metadata & the auth token as part of the 'props' on the token passed
 * down to the client. It ends by redirecting the client back to _its_ callback URL
 */
app.get("/callback", async (c) => {
	console.log("[OAUTH_HANDLER] Received OAuth callback request");
	// Accept only a state this browser started (state cookie), that exists and is unused
	const state = c.req.query("state");
	const flow = await consumeUpstreamState(c.env.CODE_VERIFIER_KV, c.req.raw, state);
	if (!flow || !state) {
		console.warn("[OAUTH_HANDLER] Rejected callback: unknown, expired, reused or foreign state");
		return c.text(
			"This sign-in session has expired or was not started in this browser. Please start the connection again from your MCP client.",
			400,
		);
	}
	const { provider, authReqInfo } = flow;
	console.log(
		`[OAUTH_HANDLER] OAuth callback received from ${provider} with provider:`,
		provider,
	);

	// Exchange the code for an access token
	const code = c.req.query("code");
	if (!code) {
		return c.text("Missing code", 400);
	}

	// Configure provider-specific parameters
	let clientId = "";
	let clientSecret = "";
	let tokenUrl = "";
	let userInfoUrl = "";
	let redirectUri = "";
	switch (provider) {
		case "github":
			clientId = c.env.GITHUB_CLIENT_ID || "";
			clientSecret = c.env.GITHUB_CLIENT_SECRET || "";
			tokenUrl = "https://github.com/login/oauth/access_token";
			userInfoUrl = "https://api.github.com/user";
			// Use a fixed redirect URI for GitHub that matches what's registered in the GitHub OAuth application settings
			redirectUri = "https://algorandmcplite.goplausible.xyz/callback";
			break;
		case "twitter":
			clientId = c.env.TWITTER_CLIENT_ID || "";
			clientSecret = c.env.TWITTER_CLIENT_SECRET || "";
			tokenUrl = "https://api.x.com/2/oauth2/token";
			userInfoUrl = "https://api.x.com/2/users/me";
			// redirectUri = new URL("/callback", c.req.url).href;

			if (!flow.codeVerifier) {
				console.error("[OAUTH_HANDLER] Missing PKCE verifier for Twitter flow");
				return c.text("Twitter session expired or PKCE missing", 400);
			}
			//redirectUri = pkce.upstreamRedirectUri;
			redirectUri = new URL("/callback", c.req.url).href;
			break;
		case "linkedin":
			clientId = c.env.LINKEDIN_CLIENT_ID || "";
			clientSecret = c.env.LINKEDIN_CLIENT_SECRET || "";
			tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
			userInfoUrl = "https://api.linkedin.com/v2/userinfo";
			redirectUri = new URL("/callback", c.req.url).href;
			break;
		case "google":
			clientId = c.env.GOOGLE_CLIENT_ID || "";
			clientSecret = c.env.GOOGLE_CLIENT_SECRET || "";
			tokenUrl = "https://accounts.google.com/o/oauth2/token";
			userInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
			redirectUri = new URL("/callback", c.req.url).href;
			break;
	}

	const [accessToken, errorResponse] = await fetchUpstreamAuthToken(c.env, {
		clientId,
		clientSecret,
		code,
		grantType: "authorization_code",
		redirectUri,
		upstreamUrl: tokenUrl,
		codeVerifier: provider === "twitter" ? flow.codeVerifier : undefined,
	});

	if (errorResponse) {
		console.error(
			`[OAUTH_HANDLER] Failed to fetch access token from ${provider}:`,
			errorResponse,
		);
		return errorResponse;
	}
	console.log(`[OAUTH_HANDLER] Successfully fetched access token from ${provider}`);

	// Fetch the user info from the provider
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
	};

	// GitHub requires Accept header and User-Agent header for REST API
	if (provider === "github") {
		headers.Accept = "application/vnd.github.v3+json";
		headers["User-Agent"] = "goplausible-remote-mcp";
	} else if (provider === "twitter") {
		headers.Authorization = `Bearer ${accessToken}`;
		headers["Content-Type"] = "application/json";
	} else if (provider === "linkedin") {
		headers.Authorization = `Bearer ${accessToken}`;
	}

	const userResponse = await fetch(userInfoUrl, { headers });

	if (!userResponse.ok) {
		const resText = await userResponse.text();
		console.error(`[OAUTH_HANDLER] Failed to fetch user info from ${provider}: ${resText}`);
		return c.text(`Failed to fetch user info: ${resText}`, 500);
	}

	// Type the user data based on the provider
	interface GitHubUser {
		id: number;
		login: string;
		name?: string;
		email?: string;
	}

	interface GitHubEmail {
		email: string;
		primary: boolean;
		verified: boolean;
	}
	interface TwitterUser {
		id: string;
		name: string;
		username: string;
	}
	interface LinkedInUser {
		sub: string;
		name: string;
		email?: string;
	}

	interface GoogleUser {
		id: string;
		name: string;
		email: string;
	}
	const res = await userResponse.json();
	// Parse the user data with the appropriate type
	const userData =
		provider === "github"
			? (res as GitHubUser)
			: provider === "twitter"
				? res && typeof res === "object" && "data" in res
					? (res.data as TwitterUser)
					: ({} as TwitterUser)
				: provider === "linkedin"
					? (res as LinkedInUser)
					: (res as GoogleUser);

	// Normalize user data based on provider
	let id: string;
	let name: string;
	let email: string;
	console.log(`[OAUTH_HANDLER] User data received: ${userData}`);

	if (provider === "github") {
		const githubUser = userData as GitHubUser;
		id = githubUser.id.toString();
		name = githubUser.name || githubUser.login;

		// If email is null or not present, we need to make an additional request
		if (!githubUser.email) {
			const emailsResponse = await fetch("https://api.github.com/user/emails", {
				headers: {
					...headers,
					"User-Agent": "goplausible-remote-mcp", // Ensure User-Agent is set for this request too
				},
			});
			if (emailsResponse.ok) {
				const emails = (await emailsResponse.json()) as GitHubEmail[];
				const primaryEmail = emails.find((e) => e.primary);
				email = primaryEmail ? primaryEmail.email : emails[0]?.email || "";
			} else {
				email = "";
			}
		} else {
			email = githubUser.email;
		}
	} else if (provider === "twitter") {
		const twitterUser = userData as TwitterUser;
		id = twitterUser.id;
		name = twitterUser.username;
		// Twitter API does not return email by default, so we generate a synthetic email
		// using the Twitter username to ensure compatibility with the vault-based account system
		email = `${twitterUser.username}`;
	} else if (provider === "linkedin") {
		const linkedInUser = userData as LinkedInUser;
		id = linkedInUser.sub;
		name = linkedInUser.name;
		email = `${linkedInUser.email}`;
	} else {
		// Google format
		const googleUser = userData as GoogleUser;
		id = googleUser.id;
		name = googleUser.name;
		email = googleUser.email;
	}

	console.log(`[OAUTH_HANDLER] Successfully fetched user info from ${provider}: `, {
		id,
		name,
		clientId: authReqInfo.clientId,
		email,
	});
	const scope = authReqInfo.scope;
	console.log(`[OAUTH_HANDLER] OAuth scope requested: ${scope}`);

	// Check once more, right before issuing the code, that the redirect URI is still
	// registered for this client (RFC 6749 §3.1.2.4)
	const client = await c.env.OAUTH_PROVIDER.lookupClient(authReqInfo.clientId);
	if (
		!client ||
		!client.redirectUris.includes(authReqInfo.redirectUri) ||
		redirectUriProblem(authReqInfo.redirectUri)
	) {
		return c.text("Invalid redirect_uri", 400);
	}

	// Return back to the MCP client a new token
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		metadata: {
			label: name,
			provider, // Store the provider in metadata
		},
		props: {
			accessToken,
			email,
			name,
			provider, // Store the provider in props
			id, // User ID
			clientId: authReqInfo.clientId, // Client ID for OAuth
		} as Props,
		request: authReqInfo,
		scope: scope,
		userId: id,
	});

	return new Response(null, {
		status: 302,
		headers: { Location: redirectTo, "Set-Cookie": clearFlowCookie(stateCookieName(state)) },
	});
});

/**
 * Logout: revokes the caller's own session.
 * Requires the access token this server issued, as `Authorization: Bearer <token>` (RFC 6750).
 * Revokes the upstream provider token kept in that session, then the grant and every token
 * issued under it. Nothing is read from query parameters and nothing outside the caller's own
 * grant is touched (client registrations are never deleted here).
 */
app.post("/logout", async (c) => {
	// The auth scheme is case-insensitive (RFC 9110 §11.1)
	const match = /^Bearer +(\S+)\s*$/i.exec(c.req.header("Authorization") || "");
	if (!match) {
		// RFC 6750 §3: no credentials presented, so no error code in the challenge
		return new Response(null, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="OAuth"' } });
	}
	const session = await c.env.OAUTH_PROVIDER.unwrapToken(match[1]);
	if (!session) {
		return c.json(
			{ error: "invalid_token", error_description: "The access token is invalid or expired" },
			401,
			{ "WWW-Authenticate": 'Bearer realm="OAuth", error="invalid_token"' },
		);
	}

	// Revoke the upstream provider token kept in this session (best effort)
	const provider = session.props?.provider;
	const upstreamToken = session.props?.accessToken;
	let upstreamRevoked = false;
	if (isOAuthProvider(provider) && typeof upstreamToken === "string" && upstreamToken) {
		try {
			upstreamRevoked = await revokeUpstreamToken(provider, upstreamToken, c.env);
		} catch (error) {
			console.error(
				"[OAUTH_HANDLER] Upstream token revocation error:",
				error instanceof Error ? error.message : error,
			);
		}
	}

	// Revoke this session's grant and every token issued under it
	await c.env.OAUTH_PROVIDER.revokeGrant(session.grantId, session.userId);
	console.log(`[OAUTH_HANDLER] Logged out grant ${session.grantId} (upstream revoked: ${upstreamRevoked})`);

	const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
	// Clear the legacy remembered-approval cookies a browser may still hold
	headers.append("Set-Cookie", "mcp-approved-clients=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0");
	headers.append("Set-Cookie", "mcp-provider-preference=; Secure; Path=/; SameSite=Lax; Max-Age=0");
	return new Response(JSON.stringify({ success: true, upstreamRevoked }), { status: 200, headers });
});

/**
 * Image proxy for MCP widget CSP compliance.
 * Serves only image URLs this server signed (IMAGE_PROXY_KEY), only image content,
 * with headers that keep it from running as a page. See src/utils/imageProxy.ts.
 */
app.get(IMAGE_PROXY_PATH, (c) => handleImageProxyRequest(c.req.url, c.env.IMAGE_PROXY_KEY));

export { app as OauthHandler };
