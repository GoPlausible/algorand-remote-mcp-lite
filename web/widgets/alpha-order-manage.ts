import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./alpha-common.css";
import { esc } from "./alpha-escape";

interface OrderManageData {
  type: "cancel" | "amend" | "match";
  success: boolean;
  marketAppId: number;
  escrowAppId: number;
  details: { label: string; value: string }[];
  txIds: string[];
  confirmedRound: number;
}

interface OrderManageStructuredContent {
  orderManageData: OrderManageData;
}

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncTxId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

const typeConfig: Record<string, { title: string; icon: string; verb: string }> = {
  cancel: {
    title: "Order Cancelled",
    icon: `<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>`,
    verb: "Cancelling",
  },
  amend: {
    title: "Order Amended",
    icon: `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
    verb: "Amending",
  },
  match: {
    title: "Match Proposed",
    icon: `<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>`,
    verb: "Proposing match",
  },
};

function renderResult(d: OrderManageData): string {
  const cfg = typeConfig[d.type] || typeConfig.cancel;
  const statusBadge = d.success
    ? `<span class="aa-badge aa-badge-yes">Success</span>`
    : `<span class="aa-badge aa-badge-no">Failed</span>`;

  const txHtml = d.txIds.map((tx) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono,'SF Mono',monospace);font-size:11px">${esc(truncTxId(tx))} <button class="aa-copy-inline" data-copy="${esc(tx)}" title="Copy Tx ID">${COPY_SVG}</button></span>`
  ).join("<br>");

  const extraRows = d.details.map((det) =>
    `<div class="aa-detail-row"><span class="aa-detail-label">${esc(det.label)}</span><span class="aa-detail-value">${esc(det.value)}</span></div>`
  ).join("");

  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon" style="${esc(d.success ? "" : "background:linear-gradient(135deg,#ef4444,#dc2626)")}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cfg.icon}</svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">${esc(cfg.title)}</div>
          <div class="aa-subtitle">${statusBadge}</div>
        </div>
      </div>

      <div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Market App ID</span>
          <span class="aa-detail-value">${esc(d.marketAppId)} <button class="aa-copy-inline" data-copy="${esc(d.marketAppId)}" title="Copy">${COPY_SVG}</button></span>
        </div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Escrow App ID</span>
          <span class="aa-detail-value">${esc(d.escrowAppId)} <button class="aa-copy-inline" data-copy="${esc(d.escrowAppId)}" title="Copy">${COPY_SVG}</button></span>
        </div>
        ${extraRows}
        <div class="aa-detail-row">
          <span class="aa-detail-label">Confirmed Round</span>
          <span class="aa-detail-value">${esc(d.confirmedRound)}</span>
        </div>
        ${d.txIds.length > 0 ? `<div class="aa-detail-row">
          <span class="aa-detail-label">Transaction${d.txIds.length > 1 ? "s" : ""}</span>
          <span class="aa-detail-value" style="text-align:right">${txHtml}</span>
        </div>` : ""}
      </div>
    </div>`;
}

function renderLoading(verb?: string): string {
  return `<div class="aa-card aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">${esc(verb || "Processing")} order...</div></div>`;
}

function renderError(msg: string): string {
  return `<div class="aa-card aa-error"><div class="aa-error-icon">!</div><div class="aa-error-text">${esc(msg)}</div></div>`;
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

const app = new App({ name: "alpha-order-manage-widget", version: "1.0.0" });

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

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as OrderManageStructuredContent | undefined;
  if (sc?.orderManageData) {
    root.innerHTML = renderResult(sc.orderManageData);
  } else {
    root.innerHTML = renderError("No order management data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
