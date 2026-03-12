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
let filterQuery = "";
let sortOrder = "default";
let sideFilter = "";

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function parsePrice(p: string): number {
  return parseFloat(p.replace(/[$,]/g, "")) || 0;
}

function renderOrderRow(o: OrderEntry): string {
  const posBadge = o.position === "YES"
    ? `<span class="aa-badge aa-badge-yes">YES</span>`
    : `<span class="aa-badge aa-badge-no">NO</span>`;
  const sideBadge = o.side === "BUY"
    ? `<span class="aa-badge aa-badge-buy">BUY</span>`
    : `<span class="aa-badge aa-badge-sell">SELL</span>`;

  return `
    <div class="aa-row">
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

document.addEventListener("click", (e) => {
  const copyBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-copy]");
  if (copyBtn) {
    e.stopPropagation();
    const text = copyBtn.dataset.copy || "";
    navigator.clipboard.writeText(text).then(() => {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = CHECK_SVG;
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    });
  }
});

app.ontoolinput = () => {
  filterQuery = ""; sortOrder = "default"; sideFilter = "";
  root.innerHTML = renderLoading();
};
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as OrdersStructuredContent | undefined;
  if (sc?.ordersData) {
    originalOrders = sc.ordersData.orders;
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
