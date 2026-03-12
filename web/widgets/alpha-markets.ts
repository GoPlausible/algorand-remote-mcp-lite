import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
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

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const BACK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

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
  const colors = ["#8b5cf6", "#6d28d9", "#0ea5e9", "#16a34a", "#dc2626", "#d97706", "#ec4899", "#0891b2", "#7c3aed", "#059669"];
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

  const endsLabel = m.endsAt
    ? new Date(m.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";

  return `
    <div class="aa-market-card" data-market-id="${m.id}" data-market-app-id="${String(m.marketAppId)}">
      <div class="aa-mc-top">
        <div class="aa-mc-icon-wrap">${iconHtml}</div>
        <div class="aa-mc-info">
          <div class="aa-mc-title">${m.title}</div>
          <div class="aa-mc-meta">
            ${statusBadge}${rewardBadge}${multiChoice}
          </div>
        </div>
        ${yesPct !== null ? `
        <div class="aa-mc-pct">
          <span class="aa-mc-pct-val">${yesPct}%</span>
          <span class="aa-mc-pct-label">Yes</span>
        </div>` : ""}
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
    filtered = filtered.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      String(m.marketAppId).includes(q) ||
      (m.source || "").toLowerCase().includes(q)
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
    filtered.sort((a, b) => new Date(a.endsAt || "9999").getTime() - new Date(b.endsAt || "9999").getTime());
  } else if (sortOrder === "end-desc") {
    filtered.sort((a, b) => new Date(b.endsAt || "").getTime() - new Date(a.endsAt || "").getTime());
  } else if (sortOrder === "title-asc") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortOrder === "pct-desc") {
    filtered.sort((a, b) => (parseYesPercent(b.yesPrice) ?? -1) - (parseYesPercent(a.yesPrice) ?? -1));
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
    paginationEl.querySelector("#aa-prev")?.addEventListener("click", () => { if (currentPage > 0) { currentPage--; renderPage(); } });
    paginationEl.querySelector("#aa-next")?.addEventListener("click", () => { if (currentPage < totalPages - 1) { currentPage++; renderPage(); } });
  } else {
    paginationEl.innerHTML = "";
  }
}

function renderMarkets(markets: MarketEntry[], type: "live" | "reward"): string {
  const hasApiData = markets.some((m) => m.yesPrice || m.volume || m.image);
  const categories = getAllCategories(markets);
  const catOptions = categories.map((c) =>
    `<option value="${c}"${categoryFilter === c ? " selected" : ""}>${c}</option>`
  ).join("");

  const icon = type === "reward"
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
        ${categories.length > 0 ? `
        <select class="list-sort-select" id="aa-cat-filter">
          <option value=""${categoryFilter === "" ? " selected" : ""}>All categories</option>
          ${catOptions}
        </select>` : ""}
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

// ---- Detail view ----

function formatDetailPrice(prob?: number): string {
  if (prob == null) return "—";
  return `$${(prob / 100).toFixed(2)}`;
}

function renderDetailView(m: MarketDetail): string {
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
    <div class="aa-card aa-card-full">
      <button class="aa-back-btn" id="aa-back">${BACK_SVG} Back to Markets</button>
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
    </div>`;
}

async function showMarketDetail(marketId: string) {
  isDetailView = true;
  root.innerHTML = `<div class="aa-card aa-card-full aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Loading market details...</div></div>`;

  try {
    const result = await app.callServerTool({
      name: "alpha_get_market",
      arguments: { marketId },
    });
    const sc = result.structuredContent as { marketDetailData?: MarketDetail } | undefined;
    if (sc?.marketDetailData) {
      root.innerHTML = renderDetailView(sc.marketDetailData);
      root.querySelector("#aa-back")?.addEventListener("click", goBackToList);
    } else {
      root.innerHTML = renderErrorWithBack("Market not found.");
      root.querySelector("#aa-back-err")?.addEventListener("click", goBackToList);
    }
  } catch (err: any) {
    console.error("Failed to load market:", err);
    root.innerHTML = renderErrorWithBack(`Failed to load market: ${err.message || "Unknown error"}`);
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
    filterInput.addEventListener("input", () => { filterQuery = filterInput.value; applyFilters(); });
  }
  if (catSelect) {
    catSelect.addEventListener("change", () => { categoryFilter = catSelect.value; applyFilters(); });
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", () => { sortOrder = sortSelect.value; applyFilters(); });
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
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(showCheck).catch(() => {
        fallbackCopy(text);
        showCheck();
      });
    } else {
      fallbackCopy(text);
      showCheck();
    }
    return;
  }

  // Market card click → detail (always use marketAppId — the numeric on-chain ID)
  const card = target.closest<HTMLElement>(".aa-market-card");
  if (card && !isDetailView) {
    const appId = card.dataset.marketAppId;
    if (appId) showMarketDetail(appId);
  }
});

app.ontoolinput = () => {
  filterQuery = ""; sortOrder = "default"; categoryFilter = ""; currentPage = 0; isDetailView = false;
  root.innerHTML = renderLoading();
};
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

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

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
