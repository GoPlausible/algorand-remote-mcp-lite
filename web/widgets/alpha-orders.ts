import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./alpha-common.css";

interface OrderEntry {
  escrowAppId: number;
  position: string;
  side: string;
  price: string;
  quantity: string;
  filled: string;
  remaining: string;
}

interface OrdersStructuredContent {
  ordersData: {
    orders: OrderEntry[];
    marketAppId: number;
    walletAddress: string;
  };
}

let originalOrders: OrderEntry[] = [];
let currentData: OrdersStructuredContent["ordersData"] | null = null;
let selectedOrder: OrderEntry | null = null;
let isEditing = false;
let currentView: "list" | "detail" = "list";
let filterQuery = "";
let sortOrder = "default";
let sideFilter = "";

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const EDIT_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const CANCEL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
const CONFIRM_SMALL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const CANCEL_SMALL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const BACK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function parsePrice(p: string): number {
  return Number.parseFloat(p.replace(/[$,]/g, "")) || 0;
}

function renderOrderRow(o: OrderEntry): string {
  const posBadge = o.position === "YES"
    ? `<span class="aa-badge aa-badge-yes">YES</span>`
    : `<span class="aa-badge aa-badge-no">NO</span>`;
  const sideBadge = o.side === "BUY"
    ? `<span class="aa-badge aa-badge-buy">BUY</span>`
    : `<span class="aa-badge aa-badge-sell">SELL</span>`;

  return `
    <div class="aa-row" data-escrow="${o.escrowAppId}" style="cursor:pointer">
      <div class="aa-row-info">
        <div class="aa-row-title">Escrow ${o.escrowAppId} <button class="aa-copy-inline" data-copy="${o.escrowAppId}" title="Copy">${COPY_SVG}</button></div>
        <div class="aa-row-sub">${posBadge}${sideBadge}<span style="font-size:10px">Qty: ${o.quantity} &middot; Filled: ${o.filled}</span></div>
      </div>
      <div class="aa-row-right">
        <span class="aa-row-price">${o.price}</span>
        <span class="aa-row-vol">Remaining: ${o.remaining}</span>
      </div>
    </div>`;
}

function applyFilters() {
  let filtered = originalOrders.slice();

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    filtered = filtered.filter((o) =>
      String(o.escrowAppId).includes(q) ||
      o.position.toLowerCase().includes(q) ||
      o.side.toLowerCase().includes(q)
    );
  }

  if (sideFilter) {
    filtered = filtered.filter((o) => {
      if (sideFilter === "buy") return o.side === "BUY";
      if (sideFilter === "sell") return o.side === "SELL";
      if (sideFilter === "yes") return o.position === "YES";
      if (sideFilter === "no") return o.position === "NO";
      return true;
    });
  }

  if (sortOrder === "price-desc") {
    filtered.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  } else if (sortOrder === "price-asc") {
    filtered.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  }

  const listEl = root.querySelector("#aa-orders-list");
  if (!listEl) return;
  if (filtered.length > 0) {
    listEl.innerHTML = filtered.map(renderOrderRow).join("");
  } else {
    listEl.innerHTML = `<div class="aa-empty">No orders match the current filter.</div>`;
  }
}

function renderOrders(data: OrdersStructuredContent["ordersData"]): string {
  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h4"/>
          </svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">Open Orders</div>
          <div class="aa-subtitle">Market ${data.marketAppId} &middot; ${truncAddr(data.walletAddress)} &middot; ${data.orders.length} order${data.orders.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div class="list-controls">
        <input type="text" class="list-filter-input" id="aa-orders-filter" placeholder="Filter orders..." value="${filterQuery}">
        <select class="list-sort-select" id="aa-orders-side">
          <option value="">All sides</option>
          <option value="buy">Buy only</option>
          <option value="sell">Sell only</option>
          <option value="yes">YES only</option>
          <option value="no">NO only</option>
        </select>
        <select class="list-sort-select" id="aa-orders-sort">
          <option value="default">Default</option>
          <option value="price-desc">Price (high)</option>
          <option value="price-asc">Price (low)</option>
        </select>
      </div>
      <div id="aa-orders-list">
        ${data.orders.length > 0 ? data.orders.map(renderOrderRow).join("") : `<div class="aa-empty">No open orders found.</div>`}
      </div>
    </div>`;
}

// ---- Order detail view ----

function renderOrderDetail(o: OrderEntry): string {
  const posBadge = o.position === "YES"
    ? `<span class="aa-badge aa-badge-yes">YES</span>`
    : `<span class="aa-badge aa-badge-no">NO</span>`;
  const sideBadge = o.side === "BUY"
    ? `<span class="aa-badge aa-badge-buy">BUY</span>`
    : `<span class="aa-badge aa-badge-sell">SELL</span>`;

  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h4"/>
          </svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">Order Detail</div>
          <div class="aa-subtitle">Escrow ${o.escrowAppId} ${posBadge}${sideBadge}</div>
        </div>
      </div>

      <div style="margin-top:4px">
        <button class="aa-order-action-btn" id="aa-back-to-list" style="background:rgba(100,100,100,.08);color:inherit;border-color:rgba(100,100,100,.2);font-size:11px;padding:4px 10px">
          ${BACK_SVG} Back to list
        </button>
      </div>

      <div style="margin-top:8px">
        <div class="aa-detail-row">
          <span class="aa-detail-label">Escrow App ID</span>
          <span class="aa-detail-value">${o.escrowAppId} <button class="aa-copy-inline" data-copy="${o.escrowAppId}" title="Copy">${COPY_SVG}</button></span>
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

function showOrderDetail(escrowAppId: number) {
  const order = originalOrders.find((o) => o.escrowAppId === escrowAppId);
  if (!order) return;
  selectedOrder = order;
  currentView = "detail";
  isEditing = false;
  root.innerHTML = renderOrderDetail(order);
  attachDetailHandlers();
}

function backToList() {
  currentView = "list";
  selectedOrder = null;
  isEditing = false;
  if (currentData) {
    root.innerHTML = renderOrders(currentData);
    attachFilterHandlers();
  }
}

function attachDetailHandlers() {
  root.querySelector("#aa-back-to-list")?.addEventListener("click", backToList);
  root.querySelector("#aa-order-edit")?.addEventListener("click", showEditMode);
  root.querySelector("#aa-order-cancel")?.addEventListener("click", cancelOrder);
}

function showEditMode() {
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
  if (!selectedOrder || !currentData) return;
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
        marketAppId: currentData.marketAppId,
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
  if (!selectedOrder || !currentData) return;
  const actionArea = root.querySelector("#aa-order-action-area");
  if (actionArea)
    actionArea.innerHTML = `<div class="aa-trade-result-msg" style="background:rgba(239,68,68,.08);color:#dc2626">Cancelling order...</div>`;

  const cancelBtn = root.querySelector("#aa-order-cancel") as HTMLButtonElement | null;
  if (cancelBtn) cancelBtn.disabled = true;

  try {
    const result = await app.callServerTool({
      name: "alpha_cancel_order",
      arguments: {
        marketAppId: currentData.marketAppId,
        escrowAppId: selectedOrder.escrowAppId,
        orderOwner: currentData.walletAddress,
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

// ---- List view handlers ----

function attachFilterHandlers() {
  const filterInput = root.querySelector("#aa-orders-filter") as HTMLInputElement | null;
  const sideSelect = root.querySelector("#aa-orders-side") as HTMLSelectElement | null;
  const sortSelect = root.querySelector("#aa-orders-sort") as HTMLSelectElement | null;

  if (filterInput) {
    filterInput.addEventListener("input", () => { filterQuery = filterInput.value; applyFilters(); });
  }
  if (sideSelect) {
    sideSelect.addEventListener("change", () => { sideFilter = sideSelect.value; applyFilters(); });
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", () => { sortOrder = sortSelect.value; applyFilters(); });
  }
}

function renderLoading(): string {
  return `<div class="aa-card aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Loading orders...</div></div>`;
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

const app = new App({ name: "alpha-orders-widget", version: "1.0.0" });

// Global click handler for copy buttons and order row clicks
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;

  // Copy button
  const copyBtn = target.closest<HTMLElement>("[data-copy]");
  if (copyBtn) {
    e.stopPropagation();
    const text = copyBtn.dataset.copy || "";
    navigator.clipboard.writeText(text).then(() => {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = CHECK_SVG;
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    });
    return;
  }

  // Order row click → show detail (only in list view)
  if (currentView === "list") {
    const row = target.closest<HTMLElement>("[data-escrow]");
    if (row) {
      const escrowId = Number(row.dataset.escrow);
      if (escrowId) showOrderDetail(escrowId);
    }
  }
});

app.ontoolinput = () => {
  filterQuery = ""; sortOrder = "default"; sideFilter = "";
  currentView = "list"; selectedOrder = null; isEditing = false;
  root.innerHTML = renderLoading();
};
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as OrdersStructuredContent | undefined;
  if (sc?.ordersData) {
    originalOrders = sc.ordersData.orders;
    currentData = sc.ordersData;
    currentView = "list";
    root.innerHTML = renderOrders(sc.ordersData);
    attachFilterHandlers();
  } else {
    root.innerHTML = renderError("No order data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
