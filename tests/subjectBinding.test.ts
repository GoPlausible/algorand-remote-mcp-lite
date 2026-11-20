import { describe, expect, it } from "vitest";
import { checkSubjectBinding, subjectBindingKey } from "../src/utils/vaultManager";

/**
 * Each Vault account is bound to the provider's permanent user ID (sub:<provider>:<entityId>), the
 * same keys doauth's client-worker, the Vault worker and algorand-remote-mcp use, so a recycled email
 * or X handle cannot inherit another person's wallet.
 */
function envWith(entries: Record<string, string>) {
	const store = new Map(Object.entries(entries));
	return {
		store,
		env: {
			VAULT_ENTITIES: {
				async get(key: string) {
					return store.get(key) ?? null;
				},
				async put(key: string, value: string) {
					store.set(key, value);
				},
			},
		} as never,
	};
}

describe("checkSubjectBinding", () => {
	it("lets a new account through (ensureUserAccount binds it when it creates it)", async () => {
		const { env, store } = envWith({});
		expect(await checkSubjectBinding(env, "github", "a@example.com", "42")).toBeNull();
		expect(store.size).toBe(0);
	});

	it("binds an existing unbound account to its first caller, then holds every caller to it", async () => {
		const { env, store } = envWith({ "github--a@example.com": "ent-1" });
		expect(await checkSubjectBinding(env, "github", "a@example.com", "42")).toBeNull();
		expect(store.get(subjectBindingKey("github", "ent-1"))).toBe("42");
		expect(await checkSubjectBinding(env, "github", "a@example.com", "42")).toBeNull();
		expect(await checkSubjectBinding(env, "github", "a@example.com", "99")).toMatch(
			/different github user/,
		);
	});

	it("refuses a session whose token carries no provider user ID", async () => {
		const { env } = envWith({ "twitter--alice": "ent-2" });
		expect(await checkSubjectBinding(env, "twitter", "alice", undefined)).toMatch(/user ID/);
	});

	it("uses the protocol key format", () => {
		expect(subjectBindingKey("google", "ent-3")).toBe("sub:google:ent-3");
	});
});
