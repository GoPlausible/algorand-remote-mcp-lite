/**
 * Alpha Arcade Manager for Algorand Remote MCP
 * Prediction market tools using @alpha-arcade/sdk with vault-based signing
 */

import { AlphaClient } from "@alpha-arcade/sdk";
import * as algosdk from "algosdk";
import { z } from "zod";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env, Props } from "../types";
import { type AssetsBinding, registerWidget } from "../ui/widgetManager";
import { getPublicKey, signWithTransit } from "../utils/vaultManager";

// ============================================
// Formatting helpers (microunits → human)
// ============================================

const formatPrice = (microunits: number): string => `$${(microunits / 1e6).toFixed(2)}`;
const formatQty = (microunits: number): string => `${(microunits / 1e6).toFixed(2)} shares`;
// yesProb / noProb from API are already in microunits (0–1000000)
const formatPriceFromProb = (microunits: number): string => `$${(microunits / 1e6).toFixed(2)}`;

// ============================================
// Alpha Arcade config
// ============================================

const MATCHER_APP_ID = 3078581851;
const USDC_ASSET_ID = 31566704;
const API_BASE_URL = "https://platform.alphaarcade.com/api";

const textResult = (text: string) => ({
	content: [{ type: "text" as const, text }],
});

// ============================================
// Client factories
// ============================================

function ConcatArrays(...arrs: ArrayLike<number>[]) {
	const size = arrs.reduce((sum, arr) => sum + arr.length, 0);
	const c = new Uint8Array(size);
	let offset = 0;
	for (let i = 0; i < arrs.length; i++) {
		c.set(arrs[i], offset);
		offset += arrs[i].length;
	}
	return c;
}

/**
 * Create a vault-backed TransactionSigner compatible with algosdk.TransactionSigner
 * Signs transactions using the user's vault key instead of a raw mnemonic
 */
function makeVaultSigner(env: Env, props: Props): algosdk.TransactionSigner {
	return async (
		txnGroup: algosdk.Transaction[],
		indexesToSign: number[],
	): Promise<Uint8Array[]> => {
		const signedTxns: Uint8Array[] = [];

		for (const idx of indexesToSign) {
			const txn = txnGroup[idx];
			const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
			const TAG = Buffer.from("TX");
			const taggedTxn = ConcatArrays(TAG, encodedTxn);
			const taggedTxnBase64 = Buffer.from(taggedTxn).toString("base64");

			const signatureResult = await signWithTransit(
				env,
				taggedTxnBase64,
				props.email!,
				props.provider!,
			);
			if (!signatureResult.success || !signatureResult.signature) {
				throw new Error(`Failed to sign transaction at index ${idx} with vault`);
			}

			const signature = Buffer.from(signatureResult.signature, "base64");
			const stxn = new algosdk.SignedTransaction({ txn, sig: new Uint8Array(signature) });
			signedTxns.push(algosdk.encodeMsgpack(stxn));
		}

		return signedTxns;
	};
}

function createReadOnlyClient(env: Env): AlphaClient {
	const apiBase = env.ALPHA_API_BASE_URL || API_BASE_URL;
	const hasApiKey = !!env.ALPHA_API_KEY;
	console.log(
		`[Alpha] Creating read-only client — apiBaseUrl=${apiBase}, hasApiKey=${hasApiKey}`,
	);
	const algodClient = new algosdk.Algodv2(
		env.ALGORAND_TOKEN || "",
		env.ALGORAND_ALGOD || "https://mainnet-api.algonode.cloud",
		"",
	);
	const indexerClient = new algosdk.Indexer(
		"",
		env.ALGORAND_INDEXER || "https://mainnet-idx.algonode.cloud",
		"",
	);
	const dummySigner: algosdk.TransactionSigner = async () => [];
	return new AlphaClient({
		algodClient,
		indexerClient,
		signer: dummySigner,
		activeAddress: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
		matcherAppId: MATCHER_APP_ID,
		usdcAssetId: USDC_ASSET_ID,
		apiBaseUrl: apiBase,
		apiKey: env.ALPHA_API_KEY || undefined,
	});
}

async function createTradingClient(env: Env, props: Props): Promise<AlphaClient> {
	if (!props.email || !props.provider) {
		throw new Error("Wallet authentication required for trading operations.");
	}

	const publicKeyResult = await getPublicKey(env, props.email, props.provider);
	if (!publicKeyResult.success || !publicKeyResult.publicKey) {
		throw new Error("Failed to get wallet public key from vault");
	}

	const pubKeyBytes = Buffer.from(publicKeyResult.publicKey, "base64");
	const activeAddress = algosdk.encodeAddress(new Uint8Array(pubKeyBytes));

	const algodClient = new algosdk.Algodv2(
		env.ALGORAND_TOKEN || "",
		env.ALGORAND_ALGOD || "https://mainnet-api.algonode.cloud",
		"",
	);
	const indexerClient = new algosdk.Indexer(
		"",
		env.ALGORAND_INDEXER || "https://mainnet-idx.algonode.cloud",
		"",
	);

	return new AlphaClient({
		algodClient,
		indexerClient,
		signer: makeVaultSigner(env, props),
		activeAddress,
		matcherAppId: MATCHER_APP_ID,
		usdcAssetId: USDC_ASSET_ID,
		apiBaseUrl: env.ALPHA_API_BASE_URL || API_BASE_URL,
		apiKey: env.ALPHA_API_KEY || undefined,
	});
}

async function resolveWalletAddress(
	env: Env,
	props: Props,
	walletAddress?: string,
): Promise<string> {
	if (walletAddress) return walletAddress;
	if (!props.email || !props.provider) {
		throw new Error("No wallet address provided and no wallet configured.");
	}
	const publicKeyResult = await getPublicKey(env, props.email, props.provider);
	if (!publicKeyResult.success || !publicKeyResult.publicKey) {
		throw new Error("Failed to get wallet address from vault");
	}
	const pubKeyBytes = Buffer.from(publicKeyResult.publicKey, "base64");
	return algosdk.encodeAddress(new Uint8Array(pubKeyBytes));
}

// ============================================
// Register tools
// ============================================

export function registerAlphaArcadeTools(
	server: McpServer,
	env: Env,
	props: Props,
	assets?: AssetsBinding,
): void {
	// ------------------------------------------
	// Widget registrations
	// ------------------------------------------

	// Images are proxied through our own worker domain so all MCP hosts
	// can load them regardless of CSP resourceDomains support for wildcards.
	const PROXY_ORIGIN = "https://algorandmcplite.goplausible.xyz";
	const alphaImageDomains = [PROXY_ORIGIN];

	/** Rewrite an image URL to go through our image proxy */
	function proxyImageUrl(url?: string): string | undefined {
		if (!url) return undefined;
		return `${PROXY_ORIGIN}/api/image-proxy?url=${encodeURIComponent(url)}`;
	}

	registerWidget(server, assets, {
		name: "alpha-markets-widget",
		htmlPath: "/widgets/alpha-markets.html",
		resourceUri: "ui://alpha/markets.html",
		description: "Alpha Arcade markets list widget",
		resourceDomains: alphaImageDomains,
	});

	registerWidget(server, assets, {
		name: "alpha-market-detail-widget",
		htmlPath: "/widgets/alpha-market-detail.html",
		resourceUri: "ui://alpha/market-detail.html",
		description: "Alpha Arcade single market detail widget",
		resourceDomains: alphaImageDomains,
	});

	registerWidget(server, assets, {
		name: "alpha-orderbook-widget",
		htmlPath: "/widgets/alpha-orderbook.html",
		resourceUri: "ui://alpha/orderbook.html",
		description: "Alpha Arcade orderbook widget",
	});

	registerWidget(server, assets, {
		name: "alpha-orders-widget",
		htmlPath: "/widgets/alpha-orders.html",
		resourceUri: "ui://alpha/orders.html",
		description: "Alpha Arcade open orders widget",
	});

	registerWidget(server, assets, {
		name: "alpha-positions-widget",
		htmlPath: "/widgets/alpha-positions.html",
		resourceUri: "ui://alpha/positions.html",
		description: "Alpha Arcade positions widget",
	});

	registerWidget(server, assets, {
		name: "alpha-trade-result-widget",
		htmlPath: "/widgets/alpha-trade-result.html",
		resourceUri: "ui://alpha/trade-result.html",
		description: "Alpha Arcade trade order result widget",
	});

	registerWidget(server, assets, {
		name: "alpha-order-manage-widget",
		htmlPath: "/widgets/alpha-order-manage.html",
		resourceUri: "ui://alpha/order-manage.html",
		description: "Alpha Arcade order management result widget",
	});

	registerWidget(server, assets, {
		name: "alpha-shares-action-widget",
		htmlPath: "/widgets/alpha-shares-action.html",
		resourceUri: "ui://alpha/shares-action.html",
		description: "Alpha Arcade shares action result widget",
	});

	// ------------------------------------------
	// Read-only tools
	// ------------------------------------------

	server.registerTool(
		"alpha_get_live_markets",
		{
			description:
				"Fetch all live Alpha Arcade prediction markets. Returns summary: id, title, marketAppId, prices, volume. Multi-choice markets have an options[] array — use options[].marketAppId for trading.",
			_meta: { ui: { resourceUri: "ui://alpha/markets.html" } },
		},
		async () => {
			try {
				console.log("[Alpha] alpha_get_live_markets — starting");
				const client = createReadOnlyClient(env);
				let markets: any[];
				try {
					console.log("[Alpha] alpha_get_live_markets — calling getLiveMarkets()");
					markets = await client.getLiveMarkets();
					console.log(
						`[Alpha] alpha_get_live_markets — getLiveMarkets() returned ${markets.length} markets`,
					);
				} catch (apiErr: any) {
					console.warn(
						`[Alpha] alpha_get_live_markets — getLiveMarkets() failed: ${apiErr.message}`,
					);
					// If API mode fails (e.g. 403 Forbidden), fall back to on-chain discovery
					if (env.ALPHA_API_KEY) {
						console.log(
							"[Alpha] alpha_get_live_markets — falling back to getMarketsOnChain()",
						);
						markets = await client.getMarketsOnChain();
						console.log(
							`[Alpha] alpha_get_live_markets — getMarketsOnChain() returned ${markets.length} markets`,
						);
					} else {
						throw apiErr;
					}
				}
				const summary = markets.map((m) => {
					const vol =
						typeof m.volume === "number"
							? m.volume
							: Number.parseFloat(String(m.volume ?? ""));
					const entry: Record<string, unknown> = {
						id: m.id,
						title: m.title || `Market ${m.marketAppId}`,
						marketAppId: m.marketAppId,
						image: proxyImageUrl(m.image),
						yesAssetId: m.yesAssetId || undefined,
						noAssetId: m.noAssetId || undefined,
						yesPrice: m.yesProb != null ? formatPriceFromProb(m.yesProb) : undefined,
						noPrice: m.noProb != null ? formatPriceFromProb(m.noProb) : undefined,
						volume: !Number.isNaN(vol) ? `$${vol.toFixed(2)}` : undefined,
						endsAt: m.endTs ? new Date(m.endTs * 1000).toISOString() : undefined,
						isResolved: m.isResolved ?? false,
						source: m.source ?? "unknown",
					};
					if (m.categories?.length) entry.categories = m.categories;
					if (m.feeBase != null) entry.feeBase = m.feeBase;
					if (m.options?.length)
						entry.options = m.options.map((o: any) => ({
							title: o.title || `Option ${o.marketAppId}`,
							marketAppId: o.marketAppId,
							yesAssetId: o.yesAssetId,
							noAssetId: o.noAssetId,
						}));
					return entry;
				});
				if (summary.length > 0) {
					const s = summary[0];
					console.log(
						`[Alpha] alpha_get_live_markets — sample: title="${s.title}", image="${s.image}", categories=${JSON.stringify(s.categories)}, source=${s.source}`,
					);
				}
				console.log(`[Alpha] alpha_get_live_markets — returning ${summary.length} markets`);
				return {
					content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
					structuredContent: {
						marketsData: { markets: summary, type: "live" },
					},
				};
			} catch (error: any) {
				console.error(
					`[Alpha] alpha_get_live_markets — error: ${error.message}`,
					error.stack,
				);
				return textResult(
					`Error fetching live markets: ${error.message || "Unknown error"}`,
				);
			}
		},
	);

	server.registerTool(
		"alpha_get_reward_markets",
		{
			description:
				"Fetch Alpha Arcade markets with liquidity rewards (totalRewards, rewardsPaidOut, etc.). Same shape as alpha_get_live_markets but includes reward info.",
			_meta: { ui: { resourceUri: "ui://alpha/markets.html" } },
		},
		async () => {
			try {
				console.log("[Alpha] alpha_get_reward_markets — starting");
				if (!env.ALPHA_API_KEY) {
					console.warn(
						"[Alpha] alpha_get_reward_markets — no API key, reward markets require API access",
					);
					return textResult(
						"Reward markets require an ALPHA_API_KEY. Set it in your environment to access reward market data.",
					);
				}
				const client = createReadOnlyClient(env);
				console.log("[Alpha] alpha_get_reward_markets — calling getRewardMarkets()");
				const markets = await client.getRewardMarkets();
				console.log(
					`[Alpha] alpha_get_reward_markets — returned ${markets.length} markets`,
				);
				const summary = markets.map((m) => {
					const vol =
						typeof m.volume === "number"
							? m.volume
							: Number.parseFloat(String(m.volume ?? ""));
					const entry: Record<string, unknown> = {
						id: m.id,
						title: m.title || `Market ${m.marketAppId}`,
						marketAppId: m.marketAppId,
						image: proxyImageUrl(m.image),
						yesAssetId: m.yesAssetId || undefined,
						noAssetId: m.noAssetId || undefined,
						yesPrice: m.yesProb != null ? formatPriceFromProb(m.yesProb) : undefined,
						noPrice: m.noProb != null ? formatPriceFromProb(m.noProb) : undefined,
						volume: !Number.isNaN(vol) ? `$${vol.toFixed(2)}` : undefined,
						endsAt: m.endTs ? new Date(m.endTs * 1000).toISOString() : undefined,
						isResolved: m.isResolved ?? false,
						source: m.source ?? "unknown",
					};
					if (m.categories?.length) entry.categories = m.categories;
					if (m.feeBase != null) entry.feeBase = m.feeBase;
					if (m.totalRewards != null) entry.totalRewards = m.totalRewards;
					if (m.rewardsPaidOut != null) entry.rewardsPaidOut = m.rewardsPaidOut;
					if (m.rewardsSpreadDistance != null)
						entry.rewardsSpreadDistance = m.rewardsSpreadDistance;
					if (m.rewardsMinContracts != null)
						entry.rewardsMinContracts = m.rewardsMinContracts;
					if (m.lastRewardAmount != null) entry.lastRewardAmount = m.lastRewardAmount;
					if (m.lastRewardTs != null)
						entry.lastRewardTs = new Date(m.lastRewardTs).toISOString();
					if (m.options?.length)
						entry.options = m.options.map((o: any) => ({
							title: o.title || `Option ${o.marketAppId}`,
							marketAppId: o.marketAppId,
							yesAssetId: o.yesAssetId,
							noAssetId: o.noAssetId,
						}));
					return entry;
				});
				return {
					content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
					structuredContent: {
						marketsData: { markets: summary, type: "reward" },
					},
				};
			} catch (error: any) {
				console.error(
					`[Alpha] alpha_get_reward_markets — error: ${error.message}`,
					error.stack,
				);
				return textResult(
					`Error fetching reward markets: ${error.message || "Unknown error"}`,
				);
			}
		},
	);

	server.registerTool(
		"alpha_get_market",
		{
			description:
				"Fetch full details for a single Alpha Arcade prediction market. Pass marketAppId (numeric, always required) and optionally marketId (UUID) for richer API data.",
			inputSchema: {
				marketAppId: z
					.number()
					.describe("The market application ID (numeric, always required)"),
				marketId: z
					.string()
					.optional()
					.describe(
						"The market UUID (optional, used for API mode when ALPHA_API_KEY is set)",
					),
			},
			_meta: { ui: { resourceUri: "ui://alpha/market-detail.html" } },
		},
		async ({ marketAppId, marketId }) => {
			try {
				console.log(
					`[Alpha] alpha_get_market — starting, marketAppId=${marketAppId}, marketId=${marketId ?? "(none)"}, hasApiKey=${!!env.ALPHA_API_KEY}`,
				);
				const client = createReadOnlyClient(env);
				let market: any = null;

				// If API key is set and UUID is available, try API first (richer data)
				if (env.ALPHA_API_KEY && marketId) {
					try {
						console.log(
							`[Alpha] alpha_get_market — trying API with UUID "${marketId}"`,
						);
						market = await client.getMarketFromApi(marketId);
						console.log(
							`[Alpha] alpha_get_market — API returned: ${market ? "data" : "null"}`,
						);
					} catch (err: any) {
						console.warn(`[Alpha] alpha_get_market — API failed: ${err.message}`);
					}
				}

				// Fall back to on-chain using numeric app ID
				if (!market) {
					console.log(
						`[Alpha] alpha_get_market — fetching on-chain with appId=${marketAppId}`,
					);
					market = await client.getMarketOnChain(marketAppId).catch((e: any) => {
						console.error(
							`[Alpha] alpha_get_market — getMarketOnChain() failed: ${e.message}`,
						);
						return null;
					});
					console.log(
						`[Alpha] alpha_get_market — on-chain returned: ${market ? "data" : "null"}`,
					);
				}

				if (!market) {
					console.warn(
						`[Alpha] alpha_get_market — no data found for marketAppId=${marketAppId}`,
					);
					return textResult(`Market ${marketAppId} not found.`);
				}
				console.log(
					`[Alpha] alpha_get_market — success, title="${market.title}", image="${market.image}", categories=${JSON.stringify(market.categories)}, source="${market.source}"`,
				);
				const proxied = { ...market, image: proxyImageUrl(market.image) };
				return {
					content: [{ type: "text" as const, text: JSON.stringify(proxied, null, 2) }],
					structuredContent: {
						marketDetailData: proxied,
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_get_market — error: ${error.message}`, error.stack);
				return textResult(`Error fetching market: ${error.message || "Unknown error"}`);
			}
		},
	);

	server.registerTool(
		"alpha_get_orderbook",
		{
			description:
				"Fetch the on-chain orderbook as a unified YES-perspective view. Merges all 4 sides (YES bids/asks + NO bids/asks). Includes spread calculation.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/orderbook.html" } },
		},
		async ({ marketAppId }) => {
			try {
				console.log(`[Alpha] alpha_get_orderbook — marketAppId=${marketAppId}`);
				const client = createReadOnlyClient(env);
				const book = await client.getOrderbook(marketAppId);
				console.log(
					`[Alpha] alpha_get_orderbook — got orderbook: YES bids=${book.yes.bids.length}, YES asks=${book.yes.asks.length}, NO bids=${book.no.bids.length}, NO asks=${book.no.asks.length}`,
				);

				type RawEntry = {
					price: number;
					quantity: number;
					escrowAppId: number;
					owner: string;
				};
				type UnifiedEntry = {
					price: string;
					priceRaw: number;
					shares: string;
					total: string;
					escrowAppId: number;
					owner: string;
					source: string;
				};

				const toUnified = (
					e: RawEntry,
					source: string,
					priceOverride?: number,
				): UnifiedEntry => {
					const p = priceOverride ?? e.price;
					const priceCents = p / 1_000_000;
					const shares = e.quantity / 1_000_000;
					return {
						price: `${(priceCents * 100).toFixed(2)}¢`,
						priceRaw: p,
						shares: `${shares.toFixed(2)}`,
						total: `$${(priceCents * shares).toFixed(2)}`,
						escrowAppId: e.escrowAppId,
						owner: e.owner,
						source,
					};
				};

				const asks: UnifiedEntry[] = [
					...book.yes.asks.map((e: RawEntry) => toUnified(e, "YES ask")),
					...book.no.bids.map((e: RawEntry) =>
						toUnified(e, "NO bid (= YES ask)", 1_000_000 - e.price),
					),
				].sort((a, b) => a.priceRaw - b.priceRaw);

				const bids: UnifiedEntry[] = [
					...book.yes.bids.map((e: RawEntry) => toUnified(e, "YES bid")),
					...book.no.asks.map((e: RawEntry) =>
						toUnified(e, "NO ask (= YES bid)", 1_000_000 - e.price),
					),
				].sort((a, b) => b.priceRaw - a.priceRaw);

				const bestAsk = asks.length > 0 ? asks[0].priceRaw : null;
				const bestBid = bids.length > 0 ? bids[0].priceRaw : null;
				const spread =
					bestAsk != null && bestBid != null
						? `${((bestAsk - bestBid) / 10_000).toFixed(2)}¢`
						: "N/A";

				const totalOrders =
					book.yes.bids.length +
					book.yes.asks.length +
					book.no.bids.length +
					book.no.asks.length;

				const orderbookResult = { unified: { asks, bids, spread }, totalOrders };
				return {
					content: [
						{ type: "text" as const, text: JSON.stringify(orderbookResult, null, 2) },
					],
					structuredContent: {
						orderbookData: { ...orderbookResult, marketAppId },
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_get_orderbook — error: ${error.message}`, error.stack);
				return textResult(`Error fetching orderbook: ${error.message || "Unknown error"}`);
			}
		},
	);

	server.registerTool(
		"alpha_get_open_orders",
		{
			description:
				"Fetch all open orders for a wallet on a specific Alpha Arcade market. Uses your MCP wallet if walletAddress is not provided.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				walletAddress: z
					.string()
					.optional()
					.describe("Algorand wallet address (uses MCP wallet if omitted)"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/orders.html" } },
		},
		async ({ marketAppId, walletAddress }) => {
			try {
				console.log(
					`[Alpha] alpha_get_open_orders — marketAppId=${marketAppId}, walletAddress=${walletAddress || "(from vault)"}`,
				);
				const address = await resolveWalletAddress(env, props, walletAddress);
				console.log(`[Alpha] alpha_get_open_orders — resolved address=${address}`);
				const client = createReadOnlyClient(env);
				const orders = await client.getOpenOrders(marketAppId, address);
				console.log(`[Alpha] alpha_get_open_orders — returned ${orders.length} orders`);
				const formatted = orders.map((o) => ({
					escrowAppId: o.escrowAppId,
					position: o.position === 1 ? "YES" : "NO",
					side: o.side === 1 ? "BUY" : "SELL",
					price: formatPrice(o.price),
					quantity: formatQty(o.quantity),
					filled: formatQty(o.quantityFilled),
					remaining: formatQty(o.quantity - o.quantityFilled),
				}));
				const text =
					formatted.length > 0
						? JSON.stringify(formatted, null, 2)
						: "No open orders found for this wallet on this market.";
				return {
					content: [{ type: "text" as const, text }],
					structuredContent: {
						ordersData: { orders: formatted, marketAppId, walletAddress: address },
					},
				};
			} catch (error: any) {
				console.error(
					`[Alpha] alpha_get_open_orders — error: ${error.message}`,
					error.stack,
				);
				return textResult(
					`Error fetching open orders: ${error.message || "Unknown error"}`,
				);
			}
		},
	);

	server.registerTool(
		"alpha_get_positions",
		{
			description:
				"Fetch all YES/NO token positions for a wallet across all Alpha Arcade markets. Uses your MCP wallet if walletAddress is not provided.",
			inputSchema: {
				walletAddress: z
					.string()
					.optional()
					.describe("Algorand wallet address (uses MCP wallet if omitted)"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/positions.html" } },
		},
		async ({ walletAddress }) => {
			try {
				console.log(
					`[Alpha] alpha_get_positions — walletAddress=${walletAddress || "(from vault)"}`,
				);
				const address = await resolveWalletAddress(env, props, walletAddress);
				const client = createReadOnlyClient(env);
				const positions = await client.getPositions(address);
				console.log(`[Alpha] alpha_get_positions — returned ${positions.length} positions`);
				const formatted = positions.map((p) => ({
					marketAppId: p.marketAppId,
					title: p.title || `Market ${p.marketAppId}`,
					yesBalance: formatQty(p.yesBalance),
					noBalance: formatQty(p.noBalance),
					yesAssetId: p.yesAssetId,
					noAssetId: p.noAssetId,
				}));
				const text =
					formatted.length > 0
						? JSON.stringify(formatted, null, 2)
						: "No positions found for this wallet.";
				return {
					content: [{ type: "text" as const, text }],
					structuredContent: {
						positionsData: { positions: formatted, walletAddress: address },
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_get_positions — error: ${error.message}`, error.stack);
				return textResult(`Error fetching positions: ${error.message || "Unknown error"}`);
			}
		},
	);

	// ------------------------------------------
	// Write tools (require vault wallet)
	// ------------------------------------------

	server.registerTool(
		"alpha_create_limit_order",
		{
			description:
				"Place a limit order on an Alpha Arcade prediction market. Price and quantity in microunits (500000 = $0.50, 1000000 = 1 share). Locks ~0.957 ALGO collateral. Returns escrowAppId — save it for cancel_order.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				position: z.union([z.literal(0), z.literal(1)]).describe("1 = Yes, 0 = No"),
				price: z.number().describe("Price in microunits (e.g. 500000 = $0.50)"),
				quantity: z.number().describe("Quantity in microunits (e.g. 1000000 = 1 share)"),
				isBuying: z.boolean().describe("true = buy order, false = sell order"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/trade-result.html" } },
		},
		async ({ marketAppId, position, price, quantity, isBuying }) => {
			try {
				const safePrice = Math.max(0, Math.round(price));
				const safeQty = Math.max(0, Math.round(quantity));
				console.log(
					`[Alpha] alpha_create_limit_order — market=${marketAppId}, pos=${position}, price=${safePrice}, qty=${safeQty}, buying=${isBuying} (raw: price=${price}, qty=${quantity})`,
				);
				if (safePrice <= 0 || safePrice > 1_000_000) {
					return textResult(
						`Invalid price: ${price}. Price must be between 1 and 1000000 microunits ($0.000001–$1.00).`,
					);
				}
				if (safeQty <= 0 || safeQty > 1_000_000_000_000) {
					return textResult(
						`Invalid quantity: ${quantity}. Quantity must be positive and reasonable.`,
					);
				}
				const client = await createTradingClient(env, props);
				const result = await client.createLimitOrder({
					marketAppId,
					position: position as 0 | 1,
					price: safePrice,
					quantity: safeQty,
					isBuying,
				});
				const posLabel = position === 1 ? "YES" : "NO";
				const sideLabel = isBuying ? "BUY" : "SELL";
				return {
					content: [
						{
							type: "text" as const,
							text: `Limit order created.\n  Market App ID: ${marketAppId}\n  Escrow App ID: ${result.escrowAppId}\n  Position: ${posLabel}\n  Side: ${sideLabel}\n  Price: ${formatPrice(price)}\n  Quantity: ${formatQty(quantity)}\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`,
						},
					],
					structuredContent: {
						tradeResultData: {
							type: "limit",
							marketAppId,
							escrowAppId: result.escrowAppId,
							position: posLabel,
							side: sideLabel,
							price: formatPrice(price),
							quantity: formatQty(quantity),
							txIds: result.txIds,
							confirmedRound: result.confirmedRound,
						},
					},
				};
			} catch (error: any) {
				console.error(
					`[Alpha] alpha_create_limit_order — error: ${error.message}`,
					error.stack,
				);
				return textResult(
					`Error creating limit order: ${error.message || "Unknown error"}`,
				);
			}
		},
	);

	server.registerTool(
		"alpha_create_market_order",
		{
			description:
				"Place a market order with auto-matching on Alpha Arcade. Price, quantity, and slippage in microunits. Returns escrowAppId, matched quantity, and actual fill price.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				position: z.union([z.literal(0), z.literal(1)]).describe("1 = Yes, 0 = No"),
				price: z.number().describe("Price in microunits (e.g. 500000 = $0.50)"),
				quantity: z.number().describe("Quantity in microunits (e.g. 1000000 = 1 share)"),
				isBuying: z.boolean().describe("true = buy order, false = sell order"),
				slippage: z
					.number()
					.describe("Slippage tolerance in microunits (e.g. 50000 = $0.05)"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/trade-result.html" } },
		},
		async ({ marketAppId, position, price, quantity, isBuying, slippage }) => {
			try {
				// Validate all numeric params are positive integers that fit uint64
				const safePrice = Math.max(0, Math.round(price));
				const safeQty = Math.max(0, Math.round(quantity));
				const safeSlip = Math.max(0, Math.round(slippage));
				console.log(
					`[Alpha] alpha_create_market_order — market=${marketAppId}, pos=${position}, price=${safePrice}, qty=${safeQty}, buying=${isBuying}, slippage=${safeSlip} (raw: price=${price}, qty=${quantity}, slip=${slippage})`,
				);
				if (safePrice <= 0 || safePrice > 1_000_000) {
					return textResult(
						`Invalid price: ${price}. Price must be between 1 and 1000000 microunits ($0.000001–$1.00).`,
					);
				}
				if (safeQty <= 0 || safeQty > 1_000_000_000_000) {
					return textResult(
						`Invalid quantity: ${quantity}. Quantity must be positive and reasonable.`,
					);
				}
				// Pre-check: estimate fundAmount to catch overflow before SDK does
				const estFund = Math.floor((safeQty * (safePrice + safeSlip)) / 1_000_000);
				if (estFund < 0 || estFund > Number.MAX_SAFE_INTEGER) {
					return textResult(
						`Computed fund amount (${estFund}) would overflow. Reduce your trade amount.`,
					);
				}
				const client = await createTradingClient(env, props);
				const result = await client.createMarketOrder({
					marketAppId,
					position: position as 0 | 1,
					price: safePrice,
					quantity: safeQty,
					isBuying,
					slippage: safeSlip,
				});
				const posLabel = position === 1 ? "YES" : "NO";
				const sideLabel = isBuying ? "BUY" : "SELL";
				return {
					content: [
						{
							type: "text" as const,
							text: `Market order created and matched.\n  Market App ID: ${marketAppId}\n  Escrow App ID: ${result.escrowAppId}\n  Position: ${posLabel}\n  Side: ${sideLabel}\n  Submitted Price: ${formatPrice(price)}\n  Fill Price: ${formatPrice(result.matchedPrice ?? 0)}\n  Quantity: ${formatQty(quantity)}\n  Matched: ${formatQty(result.matchedQuantity ?? 0)}\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`,
						},
					],
					structuredContent: {
						tradeResultData: {
							type: "market" as const,
							marketAppId,
							escrowAppId: result.escrowAppId,
							position: posLabel,
							side: sideLabel,
							price: formatPrice(price),
							quantity: formatQty(quantity),
							fillPrice: formatPrice(result.matchedPrice ?? 0),
							matchedQuantity: formatQty(result.matchedQuantity ?? 0),
							txIds: result.txIds,
							confirmedRound: result.confirmedRound,
						},
					},
				};
			} catch (error: any) {
				console.error(
					`[Alpha] alpha_create_market_order — error: ${error.message}`,
					error.stack,
				);
				return textResult(
					`Error creating market order: ${error.message || "Unknown error"}`,
				);
			}
		},
	);

	server.registerTool(
		"alpha_cancel_order",
		{
			description:
				"Cancel an open Alpha Arcade order. Requires escrowAppId and orderOwner. Refunds USDC/tokens and ~0.957 ALGO collateral.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				escrowAppId: z.number().describe("The escrow app ID of the order to cancel"),
				orderOwner: z.string().describe("The Algorand address that owns the order"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/order-manage.html" } },
		},
		async ({ marketAppId, escrowAppId, orderOwner }) => {
			try {
				console.log(
					`[Alpha] alpha_cancel_order — market=${marketAppId}, escrow=${escrowAppId}, owner=${orderOwner}`,
				);
				const client = await createTradingClient(env, props);
				const result = await client.cancelOrder({ marketAppId, escrowAppId, orderOwner });
				console.log(
					`[Alpha] alpha_cancel_order — result: txIds=${result.txIds?.join(",")}, round=${result.confirmedRound}`,
				);
				const success = result.success !== false;
				return {
					content: [
						{
							type: "text" as const,
							text: success
								? `Order cancelled successfully.\n  Market App ID: ${marketAppId}\n  Escrow App ID: ${escrowAppId}\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`
								: `Failed to cancel order ${escrowAppId}.`,
						},
					],
					structuredContent: {
						orderManageData: {
							type: "cancel" as const,
							success,
							marketAppId,
							escrowAppId,
							details: [{ label: "Order Owner", value: orderOwner }],
							txIds: result.txIds ?? [],
							confirmedRound: result.confirmedRound ?? 0,
						},
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_cancel_order — error: ${error.message}`, error.stack);
				return textResult(`Error cancelling order: ${error.message || "Unknown error"}`);
			}
		},
	);

	server.registerTool(
		"alpha_amend_order",
		{
			description:
				"Edit an existing unfilled Alpha Arcade order in-place (change price, quantity, or slippage). Faster than cancel + recreate.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				escrowAppId: z.number().describe("The escrow app ID of the order to amend"),
				price: z.number().describe("New price in microunits"),
				quantity: z.number().describe("New quantity in microunits"),
				slippage: z.number().optional().describe("New slippage in microunits (default 0)"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/order-manage.html" } },
		},
		async ({ marketAppId, escrowAppId, price, quantity, slippage }) => {
			try {
				console.log(
					`[Alpha] alpha_amend_order — market=${marketAppId}, escrow=${escrowAppId}, price=${price}, qty=${quantity}, slippage=${slippage}`,
				);
				const client = await createTradingClient(env, props);
				const result = await client.amendOrder({
					marketAppId,
					escrowAppId,
					price,
					quantity,
					slippage,
				});
				const success = result.success !== false;
				return {
					content: [
						{
							type: "text" as const,
							text: success
								? `Order amended successfully.\n  Market App ID: ${marketAppId}\n  Escrow App ID: ${escrowAppId}\n  New Price: ${formatPrice(price)}\n  New Quantity: ${formatQty(quantity)}\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`
								: `Failed to amend order ${escrowAppId}.`,
						},
					],
					structuredContent: {
						orderManageData: {
							type: "amend" as const,
							success,
							marketAppId,
							escrowAppId,
							details: [
								{ label: "New Price", value: formatPrice(price) },
								{ label: "New Quantity", value: formatQty(quantity) },
								...(slippage != null
									? [{ label: "Slippage", value: formatPrice(slippage) }]
									: []),
							],
							txIds: result.txIds ?? [],
							confirmedRound: result.confirmedRound ?? 0,
						},
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_amend_order — error: ${error.message}`, error.stack);
				return textResult(`Error amending order: ${error.message || "Unknown error"}`);
			}
		},
	);

	server.registerTool(
		"alpha_propose_match",
		{
			description:
				"Propose a match between an existing maker order and your wallet as taker on Alpha Arcade.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				makerEscrowAppId: z.number().describe("The escrow app ID of the maker order"),
				makerAddress: z.string().describe("The Algorand address of the maker"),
				quantityMatched: z.number().describe("Quantity to match in microunits"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/order-manage.html" } },
		},
		async ({ marketAppId, makerEscrowAppId, makerAddress, quantityMatched }) => {
			try {
				console.log(
					`[Alpha] alpha_propose_match — market=${marketAppId}, makerEscrow=${makerEscrowAppId}, maker=${makerAddress}, qty=${quantityMatched}`,
				);
				const client = await createTradingClient(env, props);
				const result = await client.proposeMatch({
					marketAppId,
					makerEscrowAppId,
					makerAddress,
					quantityMatched,
				});
				const success = result.success !== false;
				return {
					content: [
						{
							type: "text" as const,
							text: success
								? `Match proposed successfully.\n  Market App ID: ${marketAppId}\n  Maker Escrow: ${makerEscrowAppId}\n  Quantity: ${formatQty(quantityMatched)}\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`
								: `Failed to propose match with escrow ${makerEscrowAppId}.`,
						},
					],
					structuredContent: {
						orderManageData: {
							type: "match" as const,
							success,
							marketAppId,
							escrowAppId: makerEscrowAppId,
							details: [
								{ label: "Maker Address", value: makerAddress },
								{ label: "Quantity", value: formatQty(quantityMatched) },
							],
							txIds: result.txIds ?? [],
							confirmedRound: result.confirmedRound ?? 0,
						},
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_propose_match — error: ${error.message}`, error.stack);
				return textResult(`Error proposing match: ${error.message || "Unknown error"}`);
			}
		},
	);

	server.registerTool(
		"alpha_split_shares",
		{
			description:
				"Split USDC into equal YES and NO outcome tokens on Alpha Arcade. 1 USDC (1000000 microunits) = 1 YES + 1 NO.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				amount: z
					.number()
					.describe("Amount to split in microunits (e.g. 1000000 = $1.00 USDC)"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/shares-action.html" } },
		},
		async ({ marketAppId, amount }) => {
			try {
				console.log(`[Alpha] alpha_split_shares — market=${marketAppId}, amount=${amount}`);
				const client = await createTradingClient(env, props);
				const result = await client.splitShares({ marketAppId, amount });
				return {
					content: [
						{
							type: "text" as const,
							text: `Split ${formatPrice(amount)} USDC into YES + NO tokens.\n  Market App ID: ${marketAppId}\n  Amount: ${formatQty(amount)} each of YES and NO\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`,
						},
					],
					structuredContent: {
						sharesActionData: {
							type: "split" as const,
							marketAppId,
							amount: formatQty(amount),
							txIds: result.txIds,
							confirmedRound: result.confirmedRound,
						},
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_split_shares — error: ${error.message}`, error.stack);
				return textResult(`Error splitting shares: ${error.message || "Unknown error"}`);
			}
		},
	);

	server.registerTool(
		"alpha_merge_shares",
		{
			description:
				"Merge equal YES and NO outcome tokens back into USDC on Alpha Arcade. 1 YES + 1 NO = 1 USDC.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				amount: z.number().describe("Amount to merge in microunits"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/shares-action.html" } },
		},
		async ({ marketAppId, amount }) => {
			try {
				console.log(`[Alpha] alpha_merge_shares — market=${marketAppId}, amount=${amount}`);
				const client = await createTradingClient(env, props);
				const result = await client.mergeShares({ marketAppId, amount });
				return {
					content: [
						{
							type: "text" as const,
							text: `Merged YES + NO tokens back into ${formatPrice(amount)} USDC.\n  Market App ID: ${marketAppId}\n  Amount: ${formatQty(amount)} each of YES and NO\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`,
						},
					],
					structuredContent: {
						sharesActionData: {
							type: "merge" as const,
							marketAppId,
							amount: formatQty(amount),
							txIds: result.txIds,
							confirmedRound: result.confirmedRound,
						},
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_merge_shares — error: ${error.message}`, error.stack);
				return textResult(`Error merging shares: ${error.message || "Unknown error"}`);
			}
		},
	);

	server.registerTool(
		"alpha_claim",
		{
			description:
				"Claim USDC from a resolved Alpha Arcade market by redeeming outcome tokens. Winning = 1:1 USDC.",
			inputSchema: {
				marketAppId: z.number().describe("The market app ID"),
				assetId: z.number().describe("The outcome token ASA ID to redeem"),
				amount: z
					.number()
					.optional()
					.describe("Amount to claim in microunits (omit to claim entire balance)"),
			},
			_meta: { ui: { resourceUri: "ui://alpha/shares-action.html" } },
		},
		async ({ marketAppId, assetId, amount }) => {
			try {
				console.log(
					`[Alpha] alpha_claim — market=${marketAppId}, asset=${assetId}, amount=${amount ?? "full"}`,
				);
				const client = await createTradingClient(env, props);
				const result = await client.claim({ marketAppId, assetId, amount });
				return {
					content: [
						{
							type: "text" as const,
							text: `Claim successful.\n  Market App ID: ${marketAppId}\n  Asset ID: ${assetId}\n  Amount claimed: ${formatQty(result.amountClaimed)}\n  Tx IDs: ${result.txIds.join(", ")}\n  Confirmed round: ${result.confirmedRound}`,
						},
					],
					structuredContent: {
						sharesActionData: {
							type: "claim" as const,
							marketAppId,
							amount: amount != null ? formatQty(amount) : "Full balance",
							assetId,
							amountClaimed: formatQty(result.amountClaimed),
							txIds: result.txIds,
							confirmedRound: result.confirmedRound,
						},
					},
				};
			} catch (error: any) {
				console.error(`[Alpha] alpha_claim — error: ${error.message}`, error.stack);
				return textResult(`Error claiming: ${error.message || "Unknown error"}`);
			}
		},
	);
}
