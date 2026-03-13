import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./alpha-common.css";

interface SharesActionData {
  type: "split" | "merge" | "claim";
  marketAppId: number;
  amount: string;
  assetId?: number;
  amountClaimed?: string;
  txIds: string[];
  confirmedRound: number;
}

interface SharesActionStructuredContent {
  sharesActionData: SharesActionData;
}

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncTxId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

const typeConfig: Record<string, { title: string; subtitle: string; icon: string; color: string; verb: string }> = {
  split: {
    title: "Shares Split",
    subtitle: "USDC → YES + NO tokens",
    icon: `<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 12H3"/><path d="m7 8-4 4 4 4"/><path d="m21 8-4 4 4 4" transform="scale(-1,1) translate(-42,0)"/>`,
    color: "#8b5cf6",
    verb: "Splitting",
  },
  merge: {
    title: "Shares Merged",
    subtitle: "YES + NO tokens → USDC",
    icon: `<line x1="12" x2="12" y1="2" y2="22"/><path d="m7 8 4 4-4 4"/><path d="m17 8-4 4 4 4"/>`,
    color: "#0ea5e9",
    verb: "Merging",
  },
  claim: {
    title: "Claim Successful",
    subtitle: "Outcome tokens redeemed for USDC",
    icon: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 7 12 7s5-3 7.5-3a2.5 2.5 0 0 1 0 5H18"/><path d="M18 9v7.5A3.5 3.5 0 0 1 14.5 20h-5A3.5 3.5 0 0 1 6 16.5V9"/><path d="M12 7v6"/><path d="M9 16h6"/>`,
    color: "#16a34a",
    verb: "Claiming",
  },
};

function renderResult(d: SharesActionData): string {
  const cfg = typeConfig[d.type] || typeConfig.split;

  const txHtml = d.txIds.map((tx) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono,'SF Mono',monospace);font-size:11px">${truncTxId(tx)} <button class="aa-copy-inline" data-copy="${tx}" title="Copy Tx ID">${COPY_SVG}</button></span>`
  ).join("<br>");

  let amountPanel = "";
  if (d.type === "split") {
    amountPanel = `
      <div class="aa-pct-panels">
        <div class="aa-pct-panel" style="background:rgba(139,92,246,.08)">
          <div class="aa-pct-panel-label" style="color:#7c3aed">USDC In</div>
          <div class="aa-pct-panel-val" style="color:#7c3aed">${d.amount}</div>
        </div>
        <div class="aa-pct-panel aa-pct-yes">
          <div class="aa-pct-panel-label">YES + NO Out</div>
          <div class="aa-pct-panel-val">${d.amount}</div>
        </div>
      </div>`;
  } else if (d.type === "merge") {
    amountPanel = `
      <div class="aa-pct-panels">
        <div class="aa-pct-panel aa-pct-no">
          <div class="aa-pct-panel-label">YES + NO In</div>
          <div class="aa-pct-panel-val">${d.amount}</div>
        </div>
        <div class="aa-pct-panel" style="background:rgba(14,165,233,.08)">
          <div class="aa-pct-panel-label" style="color:#0284c7">USDC Out</div>
          <div class="aa-pct-panel-val" style="color:#0284c7">${d.amount}</div>
        </div>
      </div>`;
  } else {
    amountPanel = `
      <div class="aa-pct-panels">
        <div class="aa-pct-panel aa-pct-yes" style="flex:1">
          <div class="aa-pct-panel-label">Claimed</div>
          <div class="aa-pct-panel-val">${d.amountClaimed || d.amount}</div>
        </div>
      </div>`;
  }

  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon" style="background:linear-gradient(135deg,${cfg.color},${cfg.color}cc)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cfg.icon}</svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">${cfg.title}</div>
          <div class="aa-subtitle">${cfg.subtitle}</div>
        </div>
      </div>

      ${amountPanel}

      <div>
        <div class="aa-detail-row">
          <span class="aa-detail-label">Market App ID</span>
          <span class="aa-detail-value">${d.marketAppId} <button class="aa-copy-inline" data-copy="${d.marketAppId}" title="Copy">${COPY_SVG}</button></span>
        </div>
        ${d.assetId ? `<div class="aa-detail-row">
          <span class="aa-detail-label">Asset ID</span>
          <span class="aa-detail-value">${d.assetId} <button class="aa-copy-inline" data-copy="${d.assetId}" title="Copy">${COPY_SVG}</button></span>
        </div>` : ""}
        <div class="aa-detail-row">
          <span class="aa-detail-label">Confirmed Round</span>
          <span class="aa-detail-value">${d.confirmedRound}</span>
        </div>
        ${d.txIds.length > 0 ? `<div class="aa-detail-row">
          <span class="aa-detail-label">Transaction${d.txIds.length > 1 ? "s" : ""}</span>
          <span class="aa-detail-value" style="text-align:right">${txHtml}</span>
        </div>` : ""}
      </div>
    </div>`;
}

function renderLoading(verb?: string): string {
  return `<div class="aa-card aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">${verb || "Processing"} shares...</div></div>`;
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

const app = new App({ name: "alpha-shares-action-widget", version: "1.0.0" });

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
  const sc = result.structuredContent as SharesActionStructuredContent | undefined;
  if (sc?.sharesActionData) {
    root.innerHTML = renderResult(sc.sharesActionData);
  } else {
    root.innerHTML = renderError("No shares action data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
