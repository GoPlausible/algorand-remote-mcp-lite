import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./alpha-common.css";

interface TradeResultData {
  type: "limit" | "market";
  marketAppId: number;
  escrowAppId: number;
  position: string;
  side: string;
  price: string;
  quantity: string;
  fillPrice?: string;
  matchedQuantity?: string;
  txIds: string[];
  confirmedRound: number;
}

interface TradeResultStructuredContent {
  tradeResultData: TradeResultData;
}

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncTxId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

function renderResult(d: TradeResultData): string {
  const isMarket = d.type === "market";
  const title = isMarket ? "Market Order Filled" : "Sell Order Placed";
  const iconPath = isMarket
    ? `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>`
    : `<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`;
  const sideBadge = d.side === "BUY"
    ? `<span class="aa-badge aa-badge-buy">${d.side}</span>`
    : `<span class="aa-badge aa-badge-sell">${d.side}</span>`;
  const posBadge = d.position === "YES"
    ? `<span class="aa-badge aa-badge-yes">${d.position}</span>`
    : `<span class="aa-badge aa-badge-no">${d.position}</span>`;

  const txHtml = d.txIds.map((tx) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono,'SF Mono',monospace);font-size:11px">${truncTxId(tx)} <button class="aa-copy-inline" data-copy="${tx}" title="Copy Tx ID">${COPY_SVG}</button></span>`
  ).join("<br>");

  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">${title}</div>
          <div class="aa-subtitle">${sideBadge} ${posBadge}</div>
        </div>
      </div>

      <div class="aa-pct-panels">
        <div class="aa-pct-panel aa-pct-yes">
          <div class="aa-pct-panel-label">Price</div>
          <div class="aa-pct-panel-val" style="color:var(--color-text-primary,#1a1a2e)">${d.price}</div>
        </div>
        <div class="aa-pct-panel" style="background:rgba(139,92,246,.08)">
          <div class="aa-pct-panel-label" style="color:#7c3aed">Quantity</div>
          <div class="aa-pct-panel-val" style="color:#7c3aed">${d.quantity}</div>
        </div>
      </div>

      ${isMarket && d.fillPrice ? `
      <div class="aa-pct-panels">
        <div class="aa-pct-panel" style="background:rgba(14,165,233,.08)">
          <div class="aa-pct-panel-label" style="color:#0284c7">Fill Price</div>
          <div class="aa-pct-panel-val" style="color:#0284c7">${d.fillPrice}</div>
        </div>
        <div class="aa-pct-panel" style="background:rgba(14,165,233,.08)">
          <div class="aa-pct-panel-label" style="color:#0284c7">Matched</div>
          <div class="aa-pct-panel-val" style="color:#0284c7">${d.matchedQuantity || "—"}</div>
        </div>
      </div>` : ""}

      <div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Market App ID</span>
          <span class="aa-detail-value">${d.marketAppId} <button class="aa-copy-inline" data-copy="${d.marketAppId}" title="Copy">${COPY_SVG}</button></span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Escrow App ID</span>
          <span class="aa-detail-value">${d.escrowAppId} <button class="aa-copy-inline" data-copy="${d.escrowAppId}" title="Copy">${COPY_SVG}</button></span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Confirmed Round</span>
          <span class="aa-detail-value">${d.confirmedRound}</span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Transaction${d.txIds.length > 1 ? "s" : ""}</span>
          <span class="aa-detail-value" style="text-align:right">${txHtml}</span>
        </div>
      </div>
    </div>`;
}

function renderLoading(type?: string): string {
  const label = type === "market" ? "market order" : "sell order";
  return `<div class="aa-card aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Placing ${label}...</div></div>`;
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

const app = new App({ name: "alpha-trade-result-widget", version: "1.0.0" });

document.addEventListener("click", (e) => {
  const copyBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-copy]");
  if (copyBtn) {
    e.stopPropagation();
    const text = copyBtn.dataset.copy || "";
    navigator.clipboard.writeText(text).then(() => {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = CHECK_SVG;
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = CHECK_SVG;
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    });
  }
});

app.ontoolinput = (params) => {
  const args = params.arguments as { marketAppId?: number } | undefined;
  root.innerHTML = renderLoading(args ? "limit" : undefined);
};
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as TradeResultStructuredContent | undefined;
  if (sc?.tradeResultData) {
    root.innerHTML = renderResult(sc.tradeResultData);
  } else {
    root.innerHTML = renderError("No trade result data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
