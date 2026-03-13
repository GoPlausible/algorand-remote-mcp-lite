import {
	App,
	type McpUiHostContext,
	applyDocumentTheme,
	applyHostFonts,
	applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./alpha-common.css";

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

interface MarketDetailStructuredContent {
	marketDetailData: MarketDetail;
}

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const BACK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const EDIT_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const CANCEL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
const CONFIRM_SMALL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const CANCEL_SMALL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

// yesProb / noProb from API are already in microunits (0–1000000 = $0.00–$1.00)
function formatPrice(prob?: number): string {
	if (prob == null) return "—";
	return `$${(prob / 1_000_000).toFixed(2)}`;
}

function probToMicro(prob?: number): number {
	if (prob == null) return 500000;
	return Math.round(prob);
}

interface PositionEntry {
	marketAppId: number;
	title: string;
	yesBalance: string;
	noBalance: string;
}

let currentMarket: MarketDetail | null = null;
let openOrders: OrderEntry[] = [];
let marketPosition: PositionEntry | null = null;
let walletAddress = "";
let currentView: "market" | "order-detail" = "market";
let selectedOrder: OrderEntry | null = null;
let isEditing = false;

function renderOrderRow(o: OrderEntry): string {
	const posBadge =
		o.position === "YES"
			? `<span class="aa-badge aa-badge-yes">YES</span>`
			: `<span class="aa-badge aa-badge-no">NO</span>`;
	const sideBadge =
		o.side === "BUY"
			? `<span class="aa-badge aa-badge-buy">BUY</span>`
			: `<span class="aa-badge aa-badge-sell">SELL</span>`;

	return `
    <div class="aa-row aa-order-row" data-escrow="${o.escrowAppId}" style="cursor:pointer">
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

function renderPositionHtml(): string {
	if (!marketPosition) return "";
	return `
	<div class="aa-position-section">
		<div class="aa-trade-label">Your Position</div>
		<div style="display:flex;gap:8px;padding:4px 0">
			<div class="aa-pos-badge aa-pos-yes"><span class="aa-pos-label">YES</span> <span class="aa-pos-val">${marketPosition.yesBalance}</span></div>
			<div class="aa-pos-badge aa-pos-no"><span class="aa-pos-label">NO</span> <span class="aa-pos-val">${marketPosition.noBalance}</span></div>
		</div>
	</div>`;
}

function renderOrdersSection(): string {
	const posHtml = renderPositionHtml();

	if (openOrders.length === 0) {
		return `${posHtml}<div class="aa-orders-section">
      <div class="aa-trade-label">Your Orders</div>
      <div class="aa-empty" style="padding:12px 0">No open orders on this market.</div>
    </div>`;
	}

	return `${posHtml}<div class="aa-orders-section">
    <div class="aa-trade-label">Your Orders <span style="font-weight:500;text-transform:none;letter-spacing:0;font-size:11px;color:var(--color-text-secondary,#94a3b8)">(${openOrders.length})</span></div>
    <div id="aa-orders-list">${openOrders.map(renderOrderRow).join("")}</div>
  </div>`;
}

function renderOrderDetailView(o: OrderEntry): string {
	const m = currentMarket;
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
    <div class="aa-card">
      <button class="aa-back-btn" id="aa-back-to-market">${BACK_SVG} Back to Market</button>
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

      <div id="aa-order-fields">
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
        <div class="aa-detail-row" id="aa-od-price-row">
          <span class="aa-detail-label">Price</span>
          <span class="aa-detail-value">${o.price}</span>
        </div>
        <div class="aa-detail-row" id="aa-od-qty-row">
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
        <button class="aa-order-action-btn aa-order-edit-btn" id="aa-order-edit">${EDIT_SVG} Edit Order</button>
        <button class="aa-order-action-btn aa-order-cancel-btn" id="aa-order-cancel">${CANCEL_SVG} Cancel Order</button>
      </div>
      <div id="aa-order-action-area"></div>
    </div>`;
}

function showOrderEditMode() {
	if (!selectedOrder) return;
	isEditing = true;
	const o = selectedOrder;
	const priceVal = Number.parseFloat(o.price.replace(/[$,]/g, "")) || 0;
	const qtyVal = Number.parseFloat(o.quantity.replace(/[^0-9.]/g, "")) || 0;

	const priceRow = root.querySelector("#aa-od-price-row");
	if (priceRow) {
		priceRow.innerHTML = `
      <span class="aa-detail-label">Price</span>
      <span class="aa-detail-value aa-edit-field">
        <input type="number" class="aa-edit-input" id="aa-edit-price" value="${priceVal.toFixed(2)}" step="0.01" min="0.01" max="0.99">
      </span>`;
	}
	const qtyRow = root.querySelector("#aa-od-qty-row");
	if (qtyRow) {
		qtyRow.innerHTML = `
      <span class="aa-detail-label">Quantity</span>
      <span class="aa-detail-value aa-edit-field">
        <input type="number" class="aa-edit-input" id="aa-edit-qty" value="${qtyVal.toFixed(2)}" step="0.1" min="0.1">
      </span>`;
	}
	const actionArea = root.querySelector("#aa-order-action-area");
	if (actionArea) {
		actionArea.innerHTML = `
      <div class="aa-edit-confirm-row">
        <button class="aa-icon-btn aa-icon-btn-confirm" id="aa-edit-confirm" title="Confirm edit">${CONFIRM_SMALL_SVG}</button>
        <button class="aa-icon-btn aa-icon-btn-cancel" id="aa-edit-cancel" title="Cancel edit">${CANCEL_SMALL_SVG}</button>
      </div>`;
		actionArea.querySelector("#aa-edit-confirm")?.addEventListener("click", confirmAmendOrder);
		actionArea.querySelector("#aa-edit-cancel")?.addEventListener("click", cancelEditMode);
	}
	const editBtn = root.querySelector("#aa-order-edit") as HTMLButtonElement | null;
	if (editBtn) editBtn.disabled = true;
}

function cancelEditMode() {
	if (!selectedOrder) return;
	isEditing = false;
	const o = selectedOrder;
	const priceRow = root.querySelector("#aa-od-price-row");
	if (priceRow) {
		priceRow.innerHTML = `<span class="aa-detail-label">Price</span><span class="aa-detail-value">${o.price}</span>`;
	}
	const qtyRow = root.querySelector("#aa-od-qty-row");
	if (qtyRow) {
		qtyRow.innerHTML = `<span class="aa-detail-label">Quantity</span><span class="aa-detail-value">${o.quantity}</span>`;
	}
	const actionArea = root.querySelector("#aa-order-action-area");
	if (actionArea) actionArea.innerHTML = "";
	const editBtn = root.querySelector("#aa-order-edit") as HTMLButtonElement | null;
	if (editBtn) editBtn.disabled = false;
}

async function confirmAmendOrder() {
	if (!selectedOrder || !currentMarket) return;
	const priceInput = root.querySelector("#aa-edit-price") as HTMLInputElement | null;
	const qtyInput = root.querySelector("#aa-edit-qty") as HTMLInputElement | null;
	const price = Math.round((Number.parseFloat(priceInput?.value || "0.5") || 0.5) * 1_000_000);
	const quantity = Math.round((Number.parseFloat(qtyInput?.value || "1") || 1) * 1_000_000);

	const actionArea = root.querySelector("#aa-order-action-area");
	if (actionArea)
		actionArea.innerHTML = `<div class="aa-trade-result-msg" style="background:rgba(139,92,246,.08);color:#7c3aed">Amending order...</div>`;

	try {
		const result = await app.callServerTool({
			name: "alpha_amend_order",
			arguments: {
				marketAppId: currentMarket.marketAppId,
				escrowAppId: selectedOrder.escrowAppId,
				price,
				quantity,
			},
		});
		const text = result.content?.find((c: any) => c.type === "text") as
			| { text?: string }
			| undefined;
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-success">${text?.text || "Order amended successfully!"}</div>`;
		isEditing = false;
	} catch (err: any) {
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-error">${err.message || "Failed to amend order"}</div>`;
	}
}

async function cancelOrder() {
	if (!selectedOrder || !currentMarket) return;
	const actionArea = root.querySelector("#aa-order-action-area");
	if (actionArea)
		actionArea.innerHTML = `<div class="aa-trade-result-msg" style="background:rgba(239,68,68,.08);color:#dc2626">Cancelling order...</div>`;

	const cancelBtn = root.querySelector("#aa-order-cancel") as HTMLButtonElement | null;
	if (cancelBtn) cancelBtn.disabled = true;

	try {
		const result = await app.callServerTool({
			name: "alpha_cancel_order",
			arguments: {
				marketAppId: currentMarket.marketAppId,
				escrowAppId: selectedOrder.escrowAppId,
				orderOwner: walletAddress,
			},
		});
		const text = result.content?.find((c: any) => c.type === "text") as
			| { text?: string }
			| undefined;
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-success">${text?.text || "Order cancelled!"}</div>`;
	} catch (err: any) {
		if (actionArea)
			actionArea.innerHTML = `<div class="aa-trade-result-msg aa-trade-result-error">${err.message || "Failed to cancel order"}</div>`;
		if (cancelBtn) cancelBtn.disabled = false;
	}
}

function showOrderDetail(escrowAppId: number) {
	const order = openOrders.find((o) => o.escrowAppId === escrowAppId);
	if (!order) return;
	selectedOrder = order;
	currentView = "order-detail";
	isEditing = false;
	root.innerHTML = renderOrderDetailView(order);
	attachOrderDetailHandlers();
}

function attachOrderDetailHandlers() {
	root.querySelector("#aa-back-to-market")?.addEventListener("click", backToMarketView);
	root.querySelector("#aa-order-edit")?.addEventListener("click", showOrderEditMode);
	root.querySelector("#aa-order-cancel")?.addEventListener("click", cancelOrder);
}

function backToMarketView() {
	currentView = "market";
	selectedOrder = null;
	isEditing = false;
	if (currentMarket) {
		root.innerHTML = renderDetail(currentMarket);
		fetchOpenOrders();
	}
}

async function fetchOpenOrders() {
	if (!currentMarket) return;
	const ordersArea = root.querySelector("#aa-orders-area");
	if (ordersArea)
		ordersArea.innerHTML = `<div class="aa-orders-section"><div class="aa-trade-label">Your Orders</div><div style="padding:8px 0;font-size:12px;color:var(--color-text-secondary,#94a3b8)">Loading orders...</div></div>`;

	try {
		const result = await app.callServerTool({
			name: "alpha_get_open_orders",
			arguments: { marketAppId: currentMarket.marketAppId },
		});
		const sc = result.structuredContent as
			| { ordersData?: { orders: OrderEntry[]; walletAddress: string } }
			| undefined;
		if (sc?.ordersData) {
			openOrders = sc.ordersData.orders;
			walletAddress = sc.ordersData.walletAddress;
		} else {
			openOrders = [];
		}
	} catch {
		openOrders = [];
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
		marketPosition =
			allPositions.find((p) => p.marketAppId === currentMarket?.marketAppId) || null;
	} catch {
		marketPosition = null;
	}

	if (ordersArea) ordersArea.innerHTML = renderOrdersSection();
	fetchOrderbook();
}

async function fetchOrderbook() {
	if (!currentMarket) return;
	const area = root.querySelector("#aa-orderbook-area");
	if (!area) return;
	area.innerHTML = `<div class="aa-orderbook-section"><div class="aa-trade-label">Order Book</div><div style="padding:8px 0;font-size:12px;color:var(--color-text-secondary,#94a3b8)">Loading orderbook...</div></div>`;
	try {
		const result = await app.callServerTool({
			name: "alpha_get_orderbook",
			arguments: { marketAppId: currentMarket.marketAppId },
		});
		const sc = result.structuredContent as { orderbookData?: OrderbookData } | undefined;
		if (sc?.orderbookData) {
			area.innerHTML = renderOrderbook(sc.orderbookData);
			attachObTabHandlers(area, sc.orderbookData);
		} else {
			area.innerHTML = "";
		}
	} catch {
		area.innerHTML = "";
	}
}

function attachObTabHandlers(area: Element, _data: OrderbookData) {
	for (const tab of area.querySelectorAll<HTMLElement>("[data-ob-tab]")) {
		tab.addEventListener("click", () => {
			for (const t of area.querySelectorAll(".ob-tab")) t.classList.remove("ob-tab-active");
			tab.classList.add("ob-tab-active");
		});
	}
}

function renderDetail(m: MarketDetail): string {
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
	const iconColors = [
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
	const iconColor = iconColors[(displayTitle.charCodeAt(0) || 0) % iconColors.length];
	const iconHtml = m.image
		? `<img class="aa-mc-img" src="${m.image}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="aa-mc-icon-fallback" style="background:${iconColor};display:none">${firstLetter}</div>`
		: `<div class="aa-mc-icon-fallback" style="background:${iconColor}">${firstLetter}</div>`;

	return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-mc-icon-wrap">${iconHtml}</div>
        <div class="aa-header-text">
          <div class="aa-title">${displayTitle}</div>
          <div class="aa-subtitle">${statusBadge} ${catHtml}</div>
        </div>
      </div>

      ${m.description ? `<div style="font-size:13px;color:var(--color-text-secondary,#64748b);line-height:1.5;padding:4px 0">${m.description}</div>` : ""}

      <div style="display:flex;gap:8px;justify-content:center;padding:12px 0">
        <div style="flex:1;text-align:center;padding:12px;border-radius:12px;background:rgba(34,197,94,.08)">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#16a34a;margin-bottom:4px">Yes</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono,'SF Mono',monospace);color:#16a34a">${formatPrice(m.yesProb)}</div>
        </div>
        <div style="flex:1;text-align:center;padding:12px;border-radius:12px;background:rgba(239,68,68,.08)">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#dc2626;margin-bottom:4px">No</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono,'SF Mono',monospace);color:#dc2626">${formatPrice(m.noProb)}</div>
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
          <button class="aa-trade-btn aa-trade-btn-yes-market" data-trade="market" data-pos="1">Buy YES<span class="aa-trade-btn-sub">Market @ ${formatPrice(m.yesProb)}</span></button>
          <button class="aa-trade-btn aa-trade-btn-no-market" data-trade="market" data-pos="0">Buy NO<span class="aa-trade-btn-sub">Market @ ${formatPrice(m.noProb)}</span></button>
        </div>
        <div class="aa-trade-btns" style="margin-top:6px">
          <button class="aa-trade-btn aa-trade-btn-yes-limit" data-trade="limit" data-pos="1">Sell YES<span class="aa-trade-btn-sub">Set price &amp; qty</span></button>
          <button class="aa-trade-btn aa-trade-btn-no-limit" data-trade="limit" data-pos="0">Sell NO<span class="aa-trade-btn-sub">Set price &amp; qty</span></button>
        </div>
        <div id="aa-trade-form-area"></div>
      </div>`
				: ""
		}

      <div id="aa-orders-area"></div>
      <div id="aa-orderbook-area"></div>
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

function renderOrderbook(data: OrderbookData): string {
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

function renderLoading(id?: string): string {
	return `<div class="aa-card aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Loading market${id ? ` ${id}` : ""}...</div></div>`;
}

function renderError(msg: string): string {
	return `<div class="aa-card aa-error"><div class="aa-error-icon">!</div><div class="aa-error-text">${msg}</div></div>`;
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

const app = new App({ name: "alpha-market-detail-widget", version: "1.0.0" });

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

function showTradeForm(type: "market" | "limit", position: 0 | 1) {
	const m = currentMarket;
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
		executeTrade(type, position),
	);
}

async function executeTrade(type: "market" | "limit", position: 0 | 1) {
	const m = currentMarket;
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

document.addEventListener("click", (e) => {
	const target = e.target as HTMLElement;

	// Copy button
	const copyBtn = target.closest<HTMLElement>("[data-copy]");
	if (copyBtn) {
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

	// Trade button
	const tradeBtn = target.closest<HTMLElement>("[data-trade]");
	if (tradeBtn) {
		const type = tradeBtn.dataset.trade as "market" | "limit";
		const pos = Number(tradeBtn.dataset.pos) as 0 | 1;
		showTradeForm(type, pos);
		return;
	}

	// Rules toggle
	if (target.id === "aa-rules-toggle" && currentMarket?.rules) {
		const textEl = root.querySelector("#aa-rules-text");
		if (textEl) {
			const isExpanded = target.textContent === "Show less";
			textEl.textContent = isExpanded
				? `${currentMarket.rules.slice(0, 200)}...`
				: currentMarket.rules;
			target.textContent = isExpanded ? "Show more" : "Show less";
		}
		return;
	}

	// Order row click → order detail
	const orderRow = target.closest<HTMLElement>(".aa-order-row");
	if (orderRow) {
		const escrow = Number(orderRow.dataset.escrow);
		if (escrow) showOrderDetail(escrow);
	}
});

app.ontoolinput = (params) => {
	const args = params.arguments as { marketId?: string } | undefined;
	root.innerHTML = renderLoading(args?.marketId);
};
app.ontoolinputpartial = (params) => {
	const args = params.arguments as { marketId?: string } | undefined;
	if (args?.marketId) root.innerHTML = renderLoading(args.marketId);
};

app.ontoolresult = (result: CallToolResult) => {
	const sc = result.structuredContent as MarketDetailStructuredContent | undefined;
	if (sc?.marketDetailData) {
		currentMarket = sc.marketDetailData;
		currentView = "market";
		selectedOrder = null;
		openOrders = [];
		root.innerHTML = renderDetail(sc.marketDetailData);
		fetchOpenOrders();
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
