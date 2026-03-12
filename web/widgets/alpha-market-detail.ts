import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./alpha-common.css";

interface MarketDetail {
  id: string;
  title: string;
  description?: string;
  marketAppId: number;
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

interface MarketDetailStructuredContent {
  marketDetailData: MarketDetail;
}

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function formatPrice(prob?: number): string {
  if (prob == null) return "—";
  return `$${(prob / 100).toFixed(2)}`;
}

function renderDetail(m: MarketDetail): string {
  const statusBadge = m.isResolved
    ? `<span class="aa-badge aa-badge-resolved">Resolved${m.resolvedOutcome ? ` — ${m.resolvedOutcome}` : ""}</span>`
    : `<span class="aa-badge aa-badge-live">Live</span>`;

  const endDate = m.endTs
    ? new Date(m.endTs * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const catHtml = m.categories?.length
    ? m.categories.map((c) => `<span class="aa-badge aa-badge-source">${c}</span>`).join(" ")
    : "";

  const optionsHtml = m.options?.length
    ? `<div style="margin-top:8px"><div class="ob-section-label" style="color:var(--color-text-secondary,#64748b)">Options</div>
       ${m.options.map((o) => `
         <div class="aa-detail-row">
           <span class="aa-detail-label">${o.title}</span>
           <span class="aa-detail-value">${o.marketAppId} <button class="aa-copy-inline" data-copy="${o.marketAppId}" title="Copy">${COPY_SVG}</button></span>
         </div>`).join("")}
       </div>`
    : "";

  const rewardsHtml = m.totalRewards
    ? `<div class="aa-detail-row"><span class="aa-detail-label">Total Rewards</span><span class="aa-detail-value">$${m.totalRewards.toFixed(2)}</span></div>
       <div class="aa-detail-row"><span class="aa-detail-label">Rewards Paid</span><span class="aa-detail-value">$${(m.rewardsPaidOut || 0).toFixed(2)}</span></div>`
    : "";

  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">${m.title}</div>
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
    root.innerHTML = renderDetail(sc.marketDetailData);
  } else {
    root.innerHTML = renderError("No market data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
