import { Hono } from "hono";
import { OauthHandler } from "./oauth-handler";
import type { Env } from "./types";
import { IMAGE_PROXY_PATH, handleImageProxyRequest } from "./utils/imageProxy";

/**
 * Everything outside /sse: this server's own route (the image proxy its MCP Apps widgets use), then
 * the shared dOAuth login layer (oauth-handler.ts, a synced copy of algorand-remote-mcp's, which
 * must not be edited here).
 */
const app = new Hono<{ Bindings: Env & { IMAGE_PROXY_KEY?: string } }>();

app.get(IMAGE_PROXY_PATH, (c) => handleImageProxyRequest(c.req.url, c.env.IMAGE_PROXY_KEY));
app.all("*", (c) => OauthHandler.fetch(c.req.raw, c.env, c.executionCtx));

export { app as DefaultHandler };
