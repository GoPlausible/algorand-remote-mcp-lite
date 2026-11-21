import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * These files are synced copies, never edited here (decision D2, 2026-11-20; the login layer
 * 2026-11-21: all dOAuth servers work the same):
 * - oauth-provider.ts and the login layer (oauth-handler.ts, workers-oauth-utils.ts,
 *   pending-logins.ts), whose masters are in doauth/client-worker/src: the same on all three servers;
 * - utils/vaultManager.ts, the MCP account layer, whose master is algorand-remote-mcp/src.
 * doauth's scripts/sync-oauth-provider.mjs copies them and records each hash beside the copy.
 */
const SYNCED = [
	["oauth-provider.ts", "doauth/client-worker/src/oauth-provider.ts"],
	["oauth-handler.ts", "doauth/client-worker/src/oauth-handler.ts"],
	["workers-oauth-utils.ts", "doauth/client-worker/src/workers-oauth-utils.ts"],
	["pending-logins.ts", "doauth/client-worker/src/pending-logins.ts"],
	["utils/vaultManager.ts", "algorand-remote-mcp/src/utils/vaultManager.ts"],
] as const;

describe("synced dOAuth files", () => {
	it.each(SYNCED)("%s matches the hash recorded when it was synced", (file, master) => {
		const copy = readFileSync(new URL(`../src/${file}`, import.meta.url));
		const recorded = readFileSync(
			new URL(`../src/${file.replace(/\.ts$/, ".sha256")}`, import.meta.url),
			"utf8",
		).trim();
		const actual = createHash("sha256").update(copy).digest("hex");
		expect(
			actual,
			`src/${file} was edited locally: edit ${master} instead, then run node scripts/sync-oauth-provider.mjs in doauth`,
		).toBe(recorded);
	});
});
