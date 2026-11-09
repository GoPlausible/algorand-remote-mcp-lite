import {
	App,
	type McpUiHostContext,
	applyDocumentTheme,
	applyHostFonts,
	applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./alpha-common.css";

interface MarketEntry {
	id: string;
	title: string;
	marketAppId: number;
	image?: string;
	yesPrice?: string;
	noPrice?: string;
	volume?: string;
	endsAt?: string;
	isResolved?: boolean;
	source?: string;
	categories?: string[];
	totalRewards?: number;
	rewardsPaidOut?: number;
	lastRewardAmount?: number;
	options?: { title: string; marketAppId: number }[];
}

interface MarketDetail {
	id: string;
	title?: string;
	description?: string;
	rules?: string;
	marketAppId: number;
	image?: string;
	yesAssetId?: number;
	noAssetId?: number;
	yesProb?: number;
	noProb?: number;
	volume?: number;
	endTs?: number;
	isResolved?: boolean;
	resolvedOutcome?: string;
	source?: string;
	categories?: string[];
	feeBase?: number;
	totalRewards?: number;
	rewardsPaidOut?: number;
	options?: { title: string; marketAppId: number; yesAssetId?: number; noAssetId?: number }[];
}

interface ObOrderEntry {
	price: string;
	priceRaw: number;
	shares: string;
	total: string;
	escrowAppId: number;
	owner: string;
	source: string;
}

interface OrderbookData {
	unified: { asks: ObOrderEntry[]; bids: ObOrderEntry[]; spread: string };
	totalOrders: number;
	marketAppId: number;
}

interface OrderEntry {
	escrowAppId: number;
	position: string;
	side: string;
	price: string;
	quantity: string;
	filled: string;
	remaining: string;
}

interface MarketsStructuredContent {
	marketsData: {
		markets: MarketEntry[];
		type: "live" | "reward";
	};
}

let originalMarkets: MarketEntry[] = [];
let filteredMarkets: MarketEntry[] = [];
let filterQuery = "";
let sortOrder = "default";
let categoryFilter = "";
let marketsType: "live" | "reward" = "live";
let currentPage = 0;
const PAGE_SIZE = 10;
let isDetailView = false;
let currentDetailMarket: MarketDetail | null = null;
interface PositionEntry {
	marketAppId: number;
	title: string;
	yesBalance: string;
	noBalance: string;
}

let detailOpenOrders: OrderEntry[] = [];
let detailMarketPosition: PositionEntry | null = null;
let detailWalletAddress = "";
let detailCurrentView: "market" | "order-detail" = "market";
let detailSelectedOrder: OrderEntry | null = null;
let detailIsEditing = false;

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const BACK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const EDIT_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const CANCEL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
const CONFIRM_SMALL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const CANCEL_SMALL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

function fallbackCopy(text: string) {
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.style.position = "fixed";
	ta.style.opacity = "0";
	document.body.appendChild(ta);
	ta.select();
	document.execCommand("copy");
	document.body.removeChild(ta);
}

function parseVolume(v?: string): number {
	if (!v) return -1;
	return Number.parseFloat(v.replace(/[$,]/g, "")) || 0;
}

function formatVolume(v?: string): string {
	if (!v) return "";
	const num = Number.parseFloat(v.replace(/[$,]/g, "")) || 0;
	if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M Vol.`;
	if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K Vol.`;
	if (num > 0) return `$${num.toFixed(0)} Vol.`;
	return "";
}

function parseYesPercent(yesPrice?: string): number | null {
	if (!yesPrice) return null;
	const val = Number.parseFloat(yesPrice.replace("$", ""));
	if (Number.isNaN(val)) return null;
	return Math.round(val * 100);
}

function getAllCategories(markets: MarketEntry[]): string[] {
	const cats = new Set<string>();
	for (const m of markets) {
		if (m.categories) for (const c of m.categories) cats.add(c);
	}
	return Array.from(cats).sort();
}

// Color based on first char
function getMarketColor(title: string): string {
	const colors = [
		"#8b5cf6",
		"#6d28d9",
		"#0ea5e9",
		"#16a34a",
		"#dc2626",
		"#d97706",
		"#ec4899",
		"#0891b2",
		"#7c3aed",
		"#059669",
	];
	const code = title.charCodeAt(0) || 0;
	return colors[code % colors.length];
}

function renderMarketCard(m: MarketEntry): string {
	const firstLetter = (m.title || "?").charAt(0).toUpperCase();
	const color = getMarketColor(m.title);
	const yesPct = parseYesPercent(m.yesPrice);
	const vol = formatVolume(m.volume);

	const iconHtml = m.image
		? `<img class="aa-mc-img" src="${m.image}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="aa-mc-icon-fallback" style="background:${color};display:none">${firstLetter}</div>`
		: `<div class="aa-mc-icon-fallback" style="background:${color}">${firstLetter}</div>`;

	const statusBadge = m.isResolved
		? `<span class="aa-badge aa-badge-resolved">Resolved</span>`
		: `<span class="aa-badge aa-badge-live">Live</span>`;

	const rewardBadge = m.totalRewards
		? `<span class="aa-badge aa-badge-reward">Reward</span>`
		: "";

	const multiChoice = m.options?.length
		? `<span class="aa-badge aa-badge-source">${m.options.length} options</span>`
		: "";

	const catBadges = m.categories?.length
		? m.categories.map((c) => `<span class="aa-badge aa-badge-source">${c}</span>`).join("")
		: "";

	const endsLabel = m.endsAt
		? new Date(m.endsAt).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "";

	return `
    <div class="aa-market-card" data-market-id="${m.id}" data-market-app-id="${String(m.marketAppId)}">
      <div class="aa-mc-top">
        <div class="aa-mc-icon-wrap">${iconHtml}</div>
        <div class="aa-mc-info">
          <div class="aa-mc-title">${m.title || `Market ${m.marketAppId}`}</div>
          <div class="aa-mc-meta">
            ${statusBadge}${rewardBadge}${multiChoice}${catBadges}
          </div>
        </div>
        ${
			yesPct !== null
				? `
        <div class="aa-mc-pct">
          <span class="aa-mc-pct-val">${yesPct}%</span>
          <span class="aa-mc-pct-label">Yes</span>
        </div>`
				: ""
		}
      </div>
      <div class="aa-mc-bottom">
        ${vol ? `<span class="aa-mc-vol">${vol}</span>` : ""}
        ${endsLabel ? `<span class="aa-mc-end">${endsLabel}</span>` : ""}
        <button class="aa-copy-inline" data-copy="${String(m.marketAppId)}" title="Copy Market ID">${COPY_SVG}</button>
      </div>
    </div>`;
}

function applyFilters() {
	let filtered = originalMarkets.slice();

	if (filterQuery) {
		const q = filterQuery.toLowerCase();
		filtered = filtered.filter(
			(m) =>
				(m.title || "").toLowerCase().includes(q) ||
				String(m.marketAppId).includes(q) ||
				(m.source || "").toLowerCase().includes(q),
		);
	}

	if (categoryFilter) {
		filtered = filtered.filter((m) => m.categories?.includes(categoryFilter));
	}

	if (sortOrder === "vol-desc") {
		filtered.sort((a, b) => {
			const va = parseVolume(a.volume);
			const vb = parseVolume(b.volume);
			if (va === -1 && vb === -1) return 0;
			if (va === -1) return 1;
			if (vb === -1) return -1;
			return vb - va;
		});
	} else if (sortOrder === "vol-asc") {
		filtered.sort((a, b) => {
			const va = parseVolume(a.volume);
			const vb = parseVolume(b.volume);
			if (va === -1 && vb === -1) return 0;
			if (va === -1) return 1;
			if (vb === -1) return -1;
			return va - vb;
		});
	} else if (sortOrder === "end-asc") {
		filtered.sort(
			(a, b) =>
				new Date(a.endsAt || "9999").getTime() - new Date(b.endsAt || "9999").getTime(),
		);
	} else if (sortOrder === "end-desc") {
		filtered.sort(
			(a, b) => new Date(b.endsAt || "").getTime() - new Date(a.endsAt || "").getTime(),
		);
	} else if (sortOrder === "title-asc") {
		filtered.sort((a, b) => a.title.localeCompare(b.title));
	} else if (sortOrder === "pct-desc") {
		filtered.sort(
			(a, b) => (parseYesPercent(b.yesPrice) ?? -1) - (parseYesPercent(a.yesPrice) ?? -1),
		);
	}

	filteredMarkets = filtered;
	currentPage = 0;
	renderPage();
}

function renderPage() {
	const listEl = root.querySelector("#aa-market-list");
	const paginationEl = root.querySelector("#aa-pagination");
	if (!listEl || !paginationEl) return;

	const totalPages = Math.max(1, Math.ceil(filteredMarkets.length / PAGE_SIZE));
	if (currentPage >= totalPages) currentPage = totalPages - 1;
	if (currentPage < 0) currentPage = 0;

	const start = currentPage * PAGE_SIZE;
	const pageItems = filteredMarkets.slice(start, start + PAGE_SIZE);

	if (pageItems.length > 0) {
		listEl.innerHTML = pageItems.map(renderMarketCard).join("");
	} else {
		listEl.innerHTML = `<div class="aa-empty">No markets match the current filter.</div>`;
	}

	if (filteredMarkets.length > PAGE_SIZE) {
		paginationEl.innerHTML = `
      <button class="aa-page-btn" id="aa-prev" ${currentPage === 0 ? "disabled" : ""}>${BACK_SVG} Prev</button>
      <span class="aa-page-info">${currentPage + 1} / ${totalPages}</span>
      <button class="aa-page-btn" id="aa-next" ${currentPage >= totalPages - 1 ? "disabled" : ""}>Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>`;
		paginationEl.querySelector("#aa-prev")?.addEventListener("click", () => {
			if (currentPage > 0) {
				currentPage--;
				renderPage();
			}
		});
		paginationEl.querySelector("#aa-next")?.addEventListener("click", () => {
			if (currentPage < totalPages - 1) {
				currentPage++;
				renderPage();
			}
		});
	} else {
		paginationEl.innerHTML = "";
	}
}

function renderMarkets(markets: MarketEntry[], type: "live" | "reward"): string {
	const hasApiData = markets.some((m) => m.yesPrice || m.volume || m.image);
	const categories = getAllCategories(markets);
	const catOptions = categories
		.map((c) => `<option value="${c}"${categoryFilter === c ? " selected" : ""}>${c}</option>`)
		.join("");

	const icon =
		type === "reward"
			? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`
			: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;

	return `
    <div class="aa-card aa-card-full">
      <div class="aa-header">
        <div class="aa-icon">${icon}</div>
        <div class="aa-header-text">
          <div class="aa-title">${type === "reward" ? "Reward Markets" : "Live Markets"}</div>
          <div class="aa-subtitle">${markets.length} market${markets.length !== 1 ? "s" : ""} on Alpha Arcade${hasApiData ? "" : " (on-chain data — set ALPHA_API_KEY for images, volume & prices)"}</div>
        </div>
      </div>
      <div class="list-controls">
        <input type="text" class="list-filter-input" id="aa-filter" placeholder="Search markets..." value="${filterQuery}">
        ${
			categories.length > 0
				? `
        <select class="list-sort-select" id="aa-cat-filter">
          <option value=""${categoryFilter === "" ? " selected" : ""}>All categories</option>
          ${catOptions}
        </select>`
				: ""
		}
        <select class="list-sort-select" id="aa-sort">
          <option value="default"${sortOrder === "default" ? " selected" : ""}>Default</option>
          <option value="vol-desc"${sortOrder === "vol-desc" ? " selected" : ""}>Volume (high)</option>
          <option value="vol-asc"${sortOrder === "vol-asc" ? " selected" : ""}>Volume (low)</option>
          <option value="pct-desc"${sortOrder === "pct-desc" ? " selected" : ""}>Yes % (high)</option>
          <option value="end-asc"${sortOrder === "end-asc" ? " selected" : ""}>Ending soon</option>
          <option value="end-desc"${sortOrder === "end-desc" ? " selected" : ""}>Ending later</option>
          <option value="title-asc"${sortOrder === "title-asc" ? " selected" : ""}>Title (A-Z)</option>
        </select>
      </div>
      <div id="aa-market-list"></div>
      <div id="aa-pagination" class="aa-pagination"></div>
    </div>`;
}

// ---- Order helpers for detail view ----

function renderDetailOrderRow(o: OrderEntry): string {
	const posBadge =
		o.position === "YES"
			? `<span class="aa-badge aa-badge-yes">YES</span>`
			: `<span class="aa-badge aa-badge-no">NO</span>`;
	const sideBadge =
		o.side === "BUY"
			? `<span class="aa-badge aa-badge-buy">BUY</span>`
			: `<span class="aa-badge aa-badge-sell">SELL</span>`;

	return `
    <div class="aa-row aa-detail-order-row" data-escrow="${o.escrowAppId}" style="cursor:pointer">
      <div class="aa-row-info">
        <div class="aa-row-title">Escrow ${o.escrowAppId}</div>
        <div class="aa-row-sub">${posBadge}${sideBadge}<span style="font-size:10px">Qty: ${o.quantity} · Filled: ${o.filled}</span></div>
      </div>
      <div class="aa-row-right">
        <span class="aa-row-price">${o.price}</span>
        <span class="aa-row-vol">Rem: ${o.remaining}</span>
      </div>
    </div>`;
}

function renderDetailPositionHtml(): string {
	if (!detailMarketPosition) return "";
	return `
	<div class="aa-position-section">
		<div class="aa-trade-label">Your Position</div>
		<div style="display:flex;gap:8px;padding:4px 0">
			<div class="aa-pos-badge aa-pos-yes"><span class="aa-pos-label">YES</span> <span class="aa-pos-val">${detailMarketPosition.yesBalance}</span></div>
			<div class="aa-pos-badge aa-pos-no"><span class="aa-pos-label">NO</span> <span class="aa-pos-val">${detailMarketPosition.noBalance}</span></div>
		</div>
	</div>`;
}

function renderDetailOrdersSection(): string {
	const posHtml = renderDetailPositionHtml();

	if (detailOpenOrders.length === 0) {
		return `${posHtml}<div class="aa-orders-section">
      <div class="aa-trade-label">Your Orders</div>
      <div class="aa-empty" style="padding:12px 0">No open orders on this market.</div>
    </div>`;
	}
	return `${posHtml}<div class="aa-orders-section">
    <div class="aa-trade-label">Your Orders <span style="font-weight:500;text-transform:none;letter-spacing:0;font-size:11px;color:var(--color-text-secondary,#94a3b8)">(${detailOpenOrders.length})</span></div>
    <div id="aa-detail-orders-list">${detailOpenOrders.map(renderDetailOrderRow).join("")}</div>
  </div>`;
}

function renderDetailOrderDetailView(o: OrderEntry): string {
	const m = currentDetailMarket;
	if (!m) return "";
	const posBadge =
		o.position === "YES"
			? `<span class="aa-badge aa-badge-yes">YES</span>`
			: `<span class="aa-badge aa-badge-no">NO</span>`;
	const sideBadge =
		o.side === "BUY"
			? `<span class="aa-badge aa-badge-buy">BUY</span>`
			: `<span class="aa-badge aa-badge-sell">SELL</span>`;

	return `
    <div class="aa-card aa-card-full">
      <button class="aa-back-btn" id="aa-back-to-detail">${BACK_SVG} Back to Market</button>
      <div class="aa-header">
        <div class="aa-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h4"/>
          </svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">Order Detail</div>
          <div class="aa-subtitle">${posBadge} ${sideBadge} on ${m.title || `Market ${m.marketAppId}`}</div>
        </div>
      </div>

      <div id="aa-detail-order-fields">
        <div class="aa-detail-row">
          <span class="aa-detail-label">Escrow App ID</span>
          <span class="aa-detail-value">${o.escrowAppId} <button class="aa-copy-inline" data-copy="${o.escrowAppId}" title="Copy">${COPY_SVG}</button></span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Market App ID</span>
          <span class="aa-detail-value">${m.marketAppId} <button class="aa-copy-inline" data-copy="${m.marketAppId}" title="Copy">${COPY_SVG}</button></span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Position</span>
          <span class="aa-detail-value">${o.position}</span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Side</span>
          <span class="aa-detail-value">${o.side}</span>
        </div>
        <div class="aa-detail-row" id="aa-dod-price-row">
          <span class="aa-detail-label">Price</span>
          <span class="aa-detail-value">${o.price}</span>
        </div>
        <div class="aa-detail-row" id="aa-dod-qty-row">
          <span class="aa-detail-label">Quantity</span>
          <span class="aa-detail-value">${o.quantity}</span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Filled</span>
          <span class="aa-detail-value">${o.filled}</span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Remaining</span>
          <span class="aa-detail-value">${o.remaining}</span>
        </div>
      </div>

      <div class="aa-order-actions">
        <button class="aa-order-action-btn aa-order-edit-btn" id="aa-dorder-edit">${EDIT_SVG} Edit Order</button>
        <button class="aa-order-action-btn aa-order-cancel-btn" id="aa-dorder-cancel">${CANCEL_SVG} Cancel Order</button>
      </div>
      <div id="aa-dorder-action-area"></div>
    </div>`;
}

function showDetailOrderEditMode() {
	if (!detailSelectedOrder) return;
	detailIsEditing = true;
	const o = detailSelectedOrder;
	const priceVal = Number.parseFloat(o.price.replace(/[$,]/g, "")) || 0;
	const qtyVal = Number.parseFloat(o.quantity.replace(/[^0-9.]/g, "")) || 0;

	const priceRow = root.querySelector("#aa-dod-price-row");
	if (priceRow) {
		priceRow.innerHTML = `
      <span class="aa-detail-label">Price</span>
      <span class="aa-detail-value aa-edit-field">
        <input type="number" class="aa-edit-input" id="aa-dedit-price" value="${priceVal.toFixed(2)}" step="0.01" min="0.01" max="0.99">
      </span>`;
	}
	const qtyRow = root.querySelector("#aa-dod-qty-row");
	if (qtyRow) {
		qtyRow.innerHTML = `
      <span class="aa-detail-label">Quantity</span>
      <span class="aa-detail-value aa-edit-field">
        <input type="number" class="aa-edit-input" id="aa-dedit-qty" value="${qtyVal.toFixed(2)}" step="0.1" min="0.1">
      </span>`;
	}
	const actionArea = root.querySelector("#aa-dorder-action-area");
	if (actionArea) {
		actionArea.innerHTML = `
      <div class="aa-edit-confirm-row">
        <button class="aa-icon-btn aa-icon-btn-confirm" id="aa-dedit-confirm" title="Confirm edit">${CONFIRM_SMALL_SVG}</button>
        <button class="aa-icon-btn aa-icon-btn-cancel" id="aa-dedit-cancel" title="Cancel edit">${CANCEL_SMALL_SVG}</button>
      </div>`;
		actionArea
			.querySelector("#aa-dedit-confirm")
			?.addEventListener("click", confirmDetailAmend);
		actionArea
			.querySelector("#aa-dedit-cancel")
			?.addEventListener("click", cancelDetailEditMode);
	}
	const editBtn = root.querySelector("#aa-dorder-edit") as HTMLButtonElement | null;
	if (editBtn) editBtn.disabled = true;
}

function cancelDetailEditMode() {
	if (!detailSelectedOrder) return;
	detailIsEditing = false;
	const o = detailSelectedOrder;
	const priceRow = root.querySelector("#aa-dod-price-row");
	if (priceRow)
		priceRow.innerHTML = `<span class="aa-detail-label">Price</span><span class="aa-detail-value">${o.price}</span>`;
	const qtyRow = root.querySelector("#aa-dod-qty-row");
	if (qtyRow)
		qtyRow.innerHTML = `<span class="aa-detail-label">Quantity</span><span class="aa-detail-value">${o.quantity}</span>`;
	const actionArea = root.querySelector("#aa-dorder-action-area");
	if (actionArea) actionArea.innerHTML = "";
	const editBtn = root.querySelector("#aa-dorder-edit") as HTMLButtonElement | null;
	if (editBtn) editBtn.disabled = false;
}

async function confirmDetailAmend() {
	if (!detailSelectedOrder || !currentDetailMarket) return;
	const priceInput = root.querySelector("#aa-dedit-price") as HTMLInputElement | null;
	const qtyInput = root.querySelector("#aa-dedit-qty") as HTMLInputElement | null;
	const price = Math.round((Number.parseFloat(priceInput?.value || "0.5") || 0.5) * 1_000_000);
	const quantity = Math.round((Number.parseFloat(qtyInput?.value || "1") || 1) * 1_000_000);

	const actionArea = root.querySelector("#aa-dorder-action-area");
	if (actionArea)
		actionArea.innerHTML = `<div class="aa-trade-result-msg" style="background:rgba(139,92,246,.08);color:#7c3aed">Amending order...</div>`;

	try {
		const result = await app.callServerTool({
			name: "alpha_amend_order",
			arguments: {
				marketAppId: currentDetailMarket.marketAppId,
				escrowAppId: detailSelectedOrder.escrowAppId,
				price,
				quantity,
			},
		});
		const text = result.content?.find((c: any) => c.type === "text") as
			| { text?: string }
			| undefined;
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-success">${text?.text || "Order amended!"}</div>`;
		detailIsEditing = false;
	} catch (err: any) {
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-error">${err.message || "Failed to amend"}</div>`;
	}
}

async function cancelDetailOrder() {
	if (!detailSelectedOrder || !currentDetailMarket) return;
	const actionArea = root.querySelector("#aa-dorder-action-area");
	if (actionArea)
		actionArea.innerHTML = `<div class="aa-trade-result-msg" style="background:rgba(239,68,68,.08);color:#dc2626">Cancelling order...</div>`;

	const cancelBtn = root.querySelector("#aa-dorder-cancel") as HTMLButtonElement | null;
	if (cancelBtn) cancelBtn.disabled = true;

	try {
		const result = await app.callServerTool({
			name: "alpha_cancel_order",
			arguments: {
				marketAppId: currentDetailMarket.marketAppId,
				escrowAppId: detailSelectedOrder.escrowAppId,
				orderOwner: detailWalletAddress,
			},
		});
		const text = result.content?.find((c: any) => c.type === "text") as
			| { text?: string }
			| undefined;
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-success">${text?.text || "Order cancelled!"}</div>`;
	} catch (err: any) {
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-error">${err.message || "Failed to cancel"}</div>`;
		if (cancelBtn) cancelBtn.disabled = false;
	}
}

function showDetailOrderDetail(escrowAppId: number) {
	const order = detailOpenOrders.find((o) => o.escrowAppId === escrowAppId);
	if (!order) return;
	detailSelectedOrder = order;
	detailCurrentView = "order-detail";
	detailIsEditing = false;
	root.innerHTML = renderDetailOrderDetailView(order);
	root.querySelector("#aa-back-to-detail")?.addEventListener("click", backToDetailMarketView);
	root.querySelector("#aa-dorder-edit")?.addEventListener("click", showDetailOrderEditMode);
	root.querySelector("#aa-dorder-cancel")?.addEventListener("click", cancelDetailOrder);
}

function backToDetailMarketView() {
	detailCurrentView = "market";
	detailSelectedOrder = null;
	detailIsEditing = false;
	if (currentDetailMarket) {
		root.innerHTML = renderDetailView(currentDetailMarket);
		root.querySelector("#aa-back")?.addEventListener("click", goBackToList);
		fetchDetailOpenOrders();
	}
}

async function fetchDetailOpenOrders() {
	if (!currentDetailMarket) return;
	const ordersArea = root.querySelector("#aa-detail-orders-area");
	if (ordersArea)
		ordersArea.innerHTML = `<div class="aa-orders-section"><div class="aa-trade-label">Your Orders</div><div style="padding:8px 0;font-size:12px;color:var(--color-text-secondary,#94a3b8)">Loading orders...</div></div>`;

	try {
		const result = await app.callServerTool({
			name: "alpha_get_open_orders",
			arguments: { marketAppId: currentDetailMarket.marketAppId },
		});
		const sc = result.structuredContent as
			| { ordersData?: { orders: OrderEntry[]; walletAddress: string } }
			| undefined;
		if (sc?.ordersData) {
			detailOpenOrders = sc.ordersData.orders;
			detailWalletAddress = sc.ordersData.walletAddress;
		} else {
			detailOpenOrders = [];
		}
	} catch {
		detailOpenOrders = [];
	}

	// Fetch positions in parallel
	try {
		const posResult = await app.callServerTool({
			name: "alpha_get_positions",
			arguments: {},
		});
		const posSc = posResult.structuredContent as
			| { positionsData?: { positions: PositionEntry[] } }
			| undefined;
		const allPositions = posSc?.positionsData?.positions || [];
		detailMarketPosition =
			allPositions.find((p) => p.marketAppId === currentDetailMarket?.marketAppId) || null;
	} catch {
		detailMarketPosition = null;
	}

	if (ordersArea) ordersArea.innerHTML = renderDetailOrdersSection();
	fetchDetailOrderbook();
}

async function fetchDetailOrderbook() {
	if (!currentDetailMarket) return;
	const area = root.querySelector("#aa-detail-orderbook-area");
	if (!area) return;
	area.innerHTML = `<div class="aa-orderbook-section"><div class="aa-trade-label">Order Book</div><div style="padding:8px 0;font-size:12px;color:var(--color-text-secondary,#94a3b8)">Loading orderbook...</div></div>`;
	try {
		const result = await app.callServerTool({
			name: "alpha_get_orderbook",
			arguments: { marketAppId: currentDetailMarket.marketAppId },
		});
		const sc = result.structuredContent as { orderbookData?: OrderbookData } | undefined;
		if (sc?.orderbookData) {
			area.innerHTML = renderDetailOrderbook(sc.orderbookData);
		} else {
			area.innerHTML = "";
		}
	} catch {
		area.innerHTML = "";
	}
}

// ---- Detail view ----

// yesProb / noProb from API are already in microunits (0–1000000 = $0.00–$1.00)
function formatDetailPrice(prob?: number): string {
	if (prob == null) return "—";
	return `$${(prob / 1_000_000).toFixed(2)}`;
}

function probToMicro(prob?: number): number {
	if (prob == null) return 500000;
	return Math.round(prob);
}

function renderDetailView(m: MarketDetail): string {
	const statusBadge = m.isResolved
		? `<span class="aa-badge aa-badge-resolved">Resolved${m.resolvedOutcome ? ` — ${m.resolvedOutcome}` : ""}</span>`
		: `<span class="aa-badge aa-badge-live">Live</span>`;

	const endDate = m.endTs
		? new Date(m.endTs * 1000).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: "—";

	const catHtml = m.categories?.length
		? m.categories.map((c) => `<span class="aa-badge aa-badge-source">${c}</span>`).join(" ")
		: "";

	const optionsHtml = m.options?.length
		? `<div style="margin-top:8px"><div class="ob-section-label" style="color:var(--color-text-secondary,#64748b)">Options</div>
       ${m.options
			.map(
				(o) => `
         <div class="aa-detail-row">
           <span class="aa-detail-label">${o.title}</span>
           <span class="aa-detail-value">${o.marketAppId} <button class="aa-copy-inline" data-copy="${o.marketAppId}" title="Copy">${COPY_SVG}</button></span>
         </div>`,
			)
			.join("")}
       </div>`
		: "";

	const rewardsHtml = m.totalRewards
		? `<div class="aa-detail-row"><span class="aa-detail-label">Total Rewards</span><span class="aa-detail-value">$${m.totalRewards.toFixed(2)}</span></div>
       <div class="aa-detail-row"><span class="aa-detail-label">Rewards Paid</span><span class="aa-detail-value">$${(m.rewardsPaidOut || 0).toFixed(2)}</span></div>`
		: "";

	const displayTitle = m.title || `Market ${m.marketAppId}`;
	const firstLetter = displayTitle.charAt(0).toUpperCase();
	const color = getMarketColor(displayTitle);
	const detailIconHtml = m.image
		? `<img class="aa-mc-img" src="${m.image}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="aa-mc-icon-fallback" style="background:${color};display:none">${firstLetter}</div>`
		: `<div class="aa-mc-icon-fallback" style="background:${color}">${firstLetter}</div>`;

	return `
    <div class="aa-card aa-card-full">
      <button class="aa-back-btn" id="aa-back">${BACK_SVG} Back to Markets</button>
      <div class="aa-header">
        <div class="aa-mc-icon-wrap">${detailIconHtml}</div>
        <div class="aa-header-text">
          <div class="aa-title">${displayTitle}</div>
          <div class="aa-subtitle">${statusBadge} ${catHtml}</div>
        </div>
      </div>

      ${m.description ? `<div style="font-size:13px;color:var(--color-text-secondary,#64748b);line-height:1.5;padding:4px 0">${m.description}</div>` : ""}

      <div class="aa-pct-panels">
        <div class="aa-pct-panel aa-pct-yes">
          <div class="aa-pct-panel-label">Yes</div>
          <div class="aa-pct-panel-val">${formatDetailPrice(m.yesProb)}</div>
        </div>
        <div class="aa-pct-panel aa-pct-no">
          <div class="aa-pct-panel-label">No</div>
          <div class="aa-pct-panel-val">${formatDetailPrice(m.noProb)}</div>
        </div>
      </div>

      <div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Market App ID</span>
          <span class="aa-detail-value">${m.marketAppId} <button class="aa-copy-inline" data-copy="${m.marketAppId}" title="Copy">${COPY_SVG}</button></span>
        </div>
        ${m.yesAssetId ? `<div class="aa-detail-row"><span class="aa-detail-label">YES Asset ID</span><span class="aa-detail-value">${m.yesAssetId} <button class="aa-copy-inline" data-copy="${m.yesAssetId}" title="Copy">${COPY_SVG}</button></span></div>` : ""}
        ${m.noAssetId ? `<div class="aa-detail-row"><span class="aa-detail-label">NO Asset ID</span><span class="aa-detail-value">${m.noAssetId} <button class="aa-copy-inline" data-copy="${m.noAssetId}" title="Copy">${COPY_SVG}</button></span></div>` : ""}
        ${m.volume != null ? `<div class="aa-detail-row"><span class="aa-detail-label">Volume</span><span class="aa-detail-value">$${m.volume.toFixed(2)}</span></div>` : ""}
        <div class="aa-detail-row"><span class="aa-detail-label">Ends</span><span class="aa-detail-value">${endDate}</span></div>
        ${m.source ? `<div class="aa-detail-row"><span class="aa-detail-label">Source</span><span class="aa-detail-value">${m.source}</span></div>` : ""}
        ${m.feeBase != null ? `<div class="aa-detail-row"><span class="aa-detail-label">Fee</span><span class="aa-detail-value">${m.feeBase}%</span></div>` : ""}
        ${rewardsHtml}
      </div>
      ${optionsHtml}

      ${
			!m.isResolved && !m.options?.length
				? `
      <div class="aa-trade-section">
        <div class="aa-trade-label">Trade</div>
        <div class="aa-trade-btns">
          <button class="aa-trade-btn aa-trade-btn-yes-market" data-trade="market" data-pos="1">Buy YES<span class="aa-trade-btn-sub">Market @ ${formatDetailPrice(m.yesProb)}</span></button>
          <button class="aa-trade-btn aa-trade-btn-no-market" data-trade="market" data-pos="0">Buy NO<span class="aa-trade-btn-sub">Market @ ${formatDetailPrice(m.noProb)}</span></button>
        </div>
        <div class="aa-trade-btns" style="margin-top:6px">
          <button class="aa-trade-btn aa-trade-btn-yes-limit" data-trade="limit" data-pos="1">Sell YES<span class="aa-trade-btn-sub">Set price &amp; qty</span></button>
          <button class="aa-trade-btn aa-trade-btn-no-limit" data-trade="limit" data-pos="0">Sell NO<span class="aa-trade-btn-sub">Set price &amp; qty</span></button>
        </div>
        <div id="aa-trade-form-area"></div>
      </div>`
				: ""
		}

      <div id="aa-detail-orders-area"></div>
      <div id="aa-detail-orderbook-area"></div>
      ${
			m.rules
				? `
      <div class="aa-rules-section">
        <div class="aa-trade-label">Rules</div>
        <div class="aa-rules-text" id="aa-rules-text">${m.rules.length > 200 ? `${m.rules.slice(0, 200)}...` : m.rules}</div>
        ${m.rules.length > 200 ? `<button class="aa-rules-toggle" id="aa-rules-toggle">Show more</button>` : ""}
      </div>`
				: ""
		}
    </div>`;
}

function renderDetailOrderbook(data: OrderbookData): string {
	const { asks, bids, spread } = data.unified;
	const renderRows = (entries: ObOrderEntry[], cls: string) =>
		entries.length > 0
			? entries
					.map(
						(e) => `
				<tr>
					<td class="${cls}">${e.price}</td>
					<td>${e.shares}</td>
					<td>${e.total}</td>
				</tr>`,
					)
					.join("")
			: `<tr><td colspan="3" style="text-align:center;color:var(--color-text-secondary,#94a3b8);padding:12px">No orders</td></tr>`;

	return `
	<div class="aa-orderbook-section">
		<div class="aa-trade-label">Order Book</div>
		<div class="ob-tabs">
			<button class="ob-tab ob-tab-active" data-ob-tab="yes">Trade Yes</button>
			<button class="ob-tab" data-ob-tab="no">Trade No</button>
		</div>
		<div class="ob-section-label ob-section-asks">Asks</div>
		<table class="ob-table ob-table-compact">
			<thead><tr><th>Price</th><th>Shares</th><th>Total</th></tr></thead>
			<tbody>${renderRows(asks, "ob-ask")}</tbody>
		</table>
		<div class="ob-spread-row">Last: — &nbsp;&nbsp; Spread: ${spread}</div>
		<div class="ob-section-label ob-section-bids">Bids</div>
		<table class="ob-table ob-table-compact">
			<thead><tr><th>Price</th><th>Shares</th><th>Total</th></tr></thead>
			<tbody>${renderRows(bids, "ob-bid")}</tbody>
		</table>
	</div>`;
}

async function showMarketDetail(marketAppId: string, marketId?: string) {
	isDetailView = true;
	detailCurrentView = "market";
	detailSelectedOrder = null;
	detailOpenOrders = [];
	root.innerHTML = `<div class="aa-card aa-card-full aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Loading market details...</div></div>`;

	try {
		const args: Record<string, unknown> = { marketAppId: Number(marketAppId) };
		if (marketId) args.marketId = marketId;
		const result = await app.callServerTool({
			name: "alpha_get_market",
			arguments: args,
		});
		const sc = result.structuredContent as { marketDetailData?: MarketDetail } | undefined;
		if (sc?.marketDetailData) {
			currentDetailMarket = sc.marketDetailData;
			root.innerHTML = renderDetailView(sc.marketDetailData);
			root.querySelector("#aa-back")?.addEventListener("click", goBackToList);
			fetchDetailOpenOrders();
		} else {
			root.innerHTML = renderErrorWithBack("Market not found.");
			root.querySelector("#aa-back-err")?.addEventListener("click", goBackToList);
		}
	} catch (err: any) {
		console.error("Failed to load market:", err);
		root.innerHTML = renderErrorWithBack(
			`Failed to load market: ${err.message || "Unknown error"}`,
		);
		root.querySelector("#aa-back-err")?.addEventListener("click", goBackToList);
	}
}

function goBackToList() {
	isDetailView = false;
	root.innerHTML = renderMarkets(originalMarkets, marketsType);
	filteredMarkets = originalMarkets.slice();
	applyFilters();
	attachFilterHandlers();
}

function attachFilterHandlers() {
	const filterInput = root.querySelector("#aa-filter") as HTMLInputElement | null;
	const catSelect = root.querySelector("#aa-cat-filter") as HTMLSelectElement | null;
	const sortSelect = root.querySelector("#aa-sort") as HTMLSelectElement | null;

	if (filterInput) {
		filterInput.addEventListener("input", () => {
			filterQuery = filterInput.value;
			applyFilters();
		});
	}
	if (catSelect) {
		catSelect.addEventListener("change", () => {
			categoryFilter = catSelect.value;
			applyFilters();
		});
	}
	if (sortSelect) {
		sortSelect.addEventListener("change", () => {
			sortOrder = sortSelect.value;
			applyFilters();
		});
	}
}

function renderLoading(): string {
	return `<div class="aa-card aa-card-full aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Loading markets...</div></div>`;
}

function renderErrorWithBack(msg: string): string {
	return `<div class="aa-card aa-card-full aa-error"><button class="aa-back-btn" id="aa-back-err">${BACK_SVG} Back to Markets</button><div class="aa-error-icon">!</div><div class="aa-error-text">${msg}</div></div>`;
}

function renderError(msg: string): string {
	return `<div class="aa-card aa-card-full aa-error"><div class="aa-error-icon">!</div><div class="aa-error-text">${msg}</div></div>`;
}

const root = document.getElementById("root")!;
root.innerHTML = renderLoading();

function handleHostContextChanged(ctx: McpUiHostContext) {
	if (ctx.theme) applyDocumentTheme(ctx.theme);
	if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
	if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
	if (ctx.safeAreaInsets) {
		root.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
		root.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
		root.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
		root.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
	}
}

const app = new App({ name: "alpha-markets-widget", version: "1.0.0" });

function showTradeForm(type: "market" | "limit", position: 0 | 1) {
	const m = currentDetailMarket;
	if (!m) return;
	const area = root.querySelector("#aa-trade-form-area");
	if (!area) return;

	const posLabel = position === 1 ? "YES" : "NO";
	const colorClass = position === 1 ? "yes" : "no";
	const defaultPrice = position === 1 ? probToMicro(m.yesProb) : probToMicro(m.noProb);
	const defaultPriceDisplay = (defaultPrice / 1_000_000).toFixed(2);

	const priceRow =
		type === "limit"
			? `
    <div class="aa-trade-form-row">
      <span class="aa-trade-form-label">Price ($)</span>
      <input type="number" class="aa-trade-input" id="aa-trade-price" value="${defaultPriceDisplay}" step="0.01" min="0.01" max="0.99">
    </div>`
			: "";

	area.innerHTML = `
    <div class="aa-trade-form">
      <div class="aa-trade-form-title">${type === "market" ? "Market" : "Sell"} ${posLabel}</div>
      ${priceRow}
      <div class="aa-trade-form-row">
        <span class="aa-trade-form-label">Amount ($)</span>
        <input type="number" class="aa-trade-input" id="aa-trade-amount" value="1.00" step="0.01" min="0.01">
        <span class="aa-trade-form-hint" id="aa-trade-shares-hint"></span>
      </div>
      <div class="aa-trade-form-actions">
        <button class="aa-trade-cancel" id="aa-trade-cancel-btn">Cancel</button>
        <button class="aa-trade-confirm aa-trade-confirm-${colorClass}" id="aa-trade-confirm-btn">Confirm ${type === "market" ? "Market" : "Sell"} ${posLabel}</button>
      </div>
    </div>`;

	const updateHint = () => {
		const amountInput = root.querySelector("#aa-trade-amount") as HTMLInputElement | null;
		const priceInput = root.querySelector("#aa-trade-price") as HTMLInputElement | null;
		const hint = root.querySelector("#aa-trade-shares-hint");
		if (!hint || !amountInput) return;
		const amount = Number.parseFloat(amountInput.value) || 0;
		const price = priceInput
			? Number.parseFloat(priceInput.value) || defaultPrice / 1_000_000
			: defaultPrice / 1_000_000;
		const shares = price > 0 ? (amount / price).toFixed(2) : "0";
		hint.textContent = `≈ ${shares} shares`;
	};
	root.querySelector("#aa-trade-amount")?.addEventListener("input", updateHint);
	root.querySelector("#aa-trade-price")?.addEventListener("input", updateHint);
	updateHint();

	area.querySelector("#aa-trade-cancel-btn")?.addEventListener("click", () => {
		area.innerHTML = "";
	});
	area.querySelector("#aa-trade-confirm-btn")?.addEventListener("click", () =>
		executeListTrade(type, position),
	);
}

async function executeListTrade(type: "market" | "limit", position: 0 | 1) {
	const m = currentDetailMarket;
	if (!m) return;
	const area = root.querySelector("#aa-trade-form-area");
	if (!area) return;

	const amountInput = root.querySelector("#aa-trade-amount") as HTMLInputElement | null;
	const amount = Number.parseFloat(amountInput?.value || "1") || 1;
	const defaultPrice = position === 1 ? probToMicro(m.yesProb) : probToMicro(m.noProb);
	const priceDecimal = defaultPrice / 1_000_000;
	const quantity = Math.round((amount / priceDecimal) * 1_000_000);

	const confirmBtn = root.querySelector("#aa-trade-confirm-btn") as HTMLButtonElement | null;
	if (confirmBtn) {
		confirmBtn.disabled = true;
		confirmBtn.textContent = "Submitting...";
	}

	try {
		if (type === "market") {
			const slippage = Math.round(0.05 * 1_000_000);
			console.log(
				`[Trade] market order: marketAppId=${m.marketAppId}, pos=${position}, price=${defaultPrice}, qty=${quantity}, amount=${amount}, yesProb=${m.yesProb}, noProb=${m.noProb}`,
			);
			const result = await app.callServerTool({
				name: "alpha_create_market_order",
				arguments: {
					marketAppId: m.marketAppId,
					position,
					price: defaultPrice,
					quantity,
					isBuying: true,
					slippage,
				},
			});
			const text = result.content?.find((c: any) => c.type === "text") as
				| { text?: string }
				| undefined;
			area.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-success">${text?.text || "Market order submitted!"}</div>`;
		} else {
			const priceInput = root.querySelector("#aa-trade-price") as HTMLInputElement | null;
			const price = Math.round(
				(Number.parseFloat(priceInput?.value || String(priceDecimal)) || 0.5) * 1_000_000,
			);
			const sellQty = Math.round((amount / (price / 1_000_000)) * 1_000_000);
			const result = await app.callServerTool({
				name: "alpha_create_limit_order",
				arguments: {
					marketAppId: m.marketAppId,
					position,
					price,
					quantity: sellQty,
					isBuying: true,
				},
			});
			const text = result.content?.find((c: any) => c.type === "text") as
				| { text?: string }
				| undefined;
			area.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-success">${text?.text || "Sell order placed!"}</div>`;
		}
	} catch (err: any) {
		area.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-error">${err.message || "Trade failed"}</div>`;
	}
}

// Unified click handler
document.addEventListener("click", (e) => {
	const target = e.target as HTMLElement;

	// Copy button
	const copyBtn = target.closest<HTMLElement>("[data-copy]");
	if (copyBtn) {
		e.preventDefault();
		e.stopPropagation();
		const text = copyBtn.dataset.copy || "";
		const showCheck = () => {
			const original = copyBtn.innerHTML;
			copyBtn.innerHTML = CHECK_SVG;
			setTimeout(() => {
				copyBtn.innerHTML = original;
			}, 1500);
		};
		if (navigator.clipboard?.writeText) {
			navigator.clipboard
				.writeText(text)
				.then(showCheck)
				.catch(() => {
					fallbackCopy(text);
					showCheck();
				});
		} else {
			fallbackCopy(text);
			showCheck();
		}
		return;
	}

	// Trade button in detail view
	const tradeBtn = target.closest<HTMLElement>("[data-trade]");
	if (tradeBtn && isDetailView) {
		const type = tradeBtn.dataset.trade as "market" | "limit";
		const pos = Number(tradeBtn.dataset.pos) as 0 | 1;
		showTradeForm(type, pos);
		return;
	}

	// Rules toggle
	if (target.id === "aa-rules-toggle" && currentDetailMarket?.rules) {
		const textEl = root.querySelector("#aa-rules-text");
		if (textEl) {
			const isExpanded = target.textContent === "Show less";
			textEl.textContent = isExpanded
				? `${currentDetailMarket.rules.slice(0, 200)}...`
				: currentDetailMarket.rules;
			target.textContent = isExpanded ? "Show more" : "Show less";
		}
		return;
	}

	// Order row click → order detail (in detail view)
	const orderRow = target.closest<HTMLElement>(".aa-detail-order-row");
	if (orderRow && isDetailView) {
		const escrow = Number(orderRow.dataset.escrow);
		if (escrow) showDetailOrderDetail(escrow);
		return;
	}

	// Market card click → detail (pass both numeric appId and UUID for API)
	const card = target.closest<HTMLElement>(".aa-market-card");
	if (card && !isDetailView) {
		const appId = card.dataset.marketAppId;
		const uuid = card.dataset.marketId;
		if (appId) showMarketDetail(appId, uuid);
	}
});

app.ontoolinput = () => {
	filterQuery = "";
	sortOrder = "default";
	categoryFilter = "";
	currentPage = 0;
	isDetailView = false;
	root.innerHTML = renderLoading();
};
app.ontoolinputpartial = () => {
	root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
	const sc = result.structuredContent as MarketsStructuredContent | undefined;
	if (sc?.marketsData) {
		originalMarkets = sc.marketsData.markets;
		marketsType = sc.marketsData.type;
		filteredMarkets = originalMarkets.slice();
		isDetailView = false;
		root.innerHTML = renderMarkets(originalMarkets, marketsType);
		applyFilters();
		attachFilterHandlers();
	} else {
		root.innerHTML = renderError("No market data returned.");
	}
};

app.ontoolcancelled = () => {
	root.innerHTML = renderError("Request was cancelled.");
};
app.onerror = (err) => {
	console.error("App error:", err);
	root.innerHTML = renderError("An error occurred.");
};
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
	const ctx = app.getHostContext();
	if (ctx) handleHostContextChanged(ctx);
});
