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
  price: string;
  priceRaw: number;
  shares: string;
  total: string;
  escrowAppId: number;
  owner: string;
  source: string;
}

interface OrderbookData {
  unified: {
    asks: OrderEntry[];
    bids: OrderEntry[];
    spread: string;
  };
  totalOrders: number;
  marketAppId: number;
}

interface OrderbookStructuredContent {
  orderbookData: OrderbookData;
}

const COPY_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function renderOrderbook(data: OrderbookData): string {
  const { asks, bids, spread } = data.unified;

  const renderRows = (entries: OrderEntry[], cls: string) =>
    entries.length > 0
      ? entries.map((e) => `
          <tr>
            <td class="${cls}">${e.price}</td>
            <td>${e.shares}</td>
            <td>${e.total}</td>
            <td style="font-size:10px;color:var(--color-text-secondary,#94a3b8)">${truncAddr(e.owner)} <button class="aa-copy-inline" data-copy="${e.owner}" title="Copy owner">${COPY_SVG}</button></td>
          </tr>`).join("")
      : `<tr><td colspan="4" style="text-align:center;color:var(--color-text-secondary,#94a3b8);padding:12px">No orders</td></tr>`;

  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
          </svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">Orderbook</div>
          <div class="aa-subtitle">Market ${data.marketAppId} &middot; ${data.totalOrders} orders</div>
        </div>
      </div>

      <div class="ob-section-label ob-section-asks">Asks (Sell)</div>
      <table class="ob-table">
        <thead><tr><th>Price</th><th>Shares</th><th>Total</th><th>Owner</th></tr></thead>
        <tbody>${renderRows(asks, "ob-ask")}</tbody>
      </table>

      <div class="ob-spread-row">Spread: ${spread}</div>

      <div class="ob-section-label ob-section-bids">Bids (Buy)</div>
      <table class="ob-table">
        <thead><tr><th>Price</th><th>Shares</th><th>Total</th><th>Owner</th></tr></thead>
        <tbody>${renderRows(bids, "ob-bid")}</tbody>
      </table>
    </div>`;
}

function renderLoading(): string {
  return `<div class="aa-card aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Loading orderbook...</div></div>`;
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

const app = new App({ name: "alpha-orderbook-widget", version: "1.0.0" });

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

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as OrderbookStructuredContent | undefined;
  if (sc?.orderbookData) {
    root.innerHTML = renderOrderbook(sc.orderbookData);
  } else {
    root.innerHTML = renderError("No orderbook data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
