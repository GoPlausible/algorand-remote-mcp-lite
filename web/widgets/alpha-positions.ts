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

interface PositionEntry {
  marketAppId: number;
  title: string;
  yesBalance: string;
  noBalance: string;
  yesAssetId: number;
  noAssetId: number;
}

interface PositionsStructuredContent {
  positionsData: {
    positions: PositionEntry[];
    walletAddress: string;
  };
}

let originalPositions: PositionEntry[] = [];
let filterQuery = "";
let sortOrder = "default";

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function parseShares(s: string): number {
  return parseFloat(s.replace(/[^\d.]/g, "")) || 0;
}

function renderPositionRow(p: PositionEntry): string {
  return `
    <div class="aa-row">
      <div class="aa-row-info">
        <div class="aa-row-title">${esc(p.title)}</div>
        <div class="aa-row-sub">
          <span style="font-size:10px">App ${esc(p.marketAppId)}</span>
          <button class="aa-copy-inline" data-copy="${esc(p.marketAppId)}" title="Copy App ID">${COPY_SVG}</button>
        </div>
      </div>
      <div class="aa-row-right">
        <div class="aa-row-badges">
          <span class="aa-badge aa-badge-yes">YES ${esc(p.yesBalance)}</span>
          <span class="aa-badge aa-badge-no">NO ${esc(p.noBalance)}</span>
        </div>
      </div>
    </div>`;
}

function applyFilters() {
  let filtered = originalPositions.slice();

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    filtered = filtered.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      String(p.marketAppId).includes(q)
    );
  }

  if (sortOrder === "yes-desc") {
    filtered.sort((a, b) => parseShares(b.yesBalance) - parseShares(a.yesBalance));
  } else if (sortOrder === "no-desc") {
    filtered.sort((a, b) => parseShares(b.noBalance) - parseShares(a.noBalance));
  } else if (sortOrder === "title-asc") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  const listEl = root.querySelector("#aa-positions-list");
  if (!listEl) return;
  if (filtered.length > 0) {
    listEl.innerHTML = filtered.map(renderPositionRow).join("");
  } else {
    listEl.innerHTML = `<div class="aa-empty">No positions match the current filter.</div>`;
  }
}

function renderPositions(data: PositionsStructuredContent["positionsData"]): string {
  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
          </svg>
        </div>
        <div class="aa-header-text">
          <div class="aa-title">Positions</div>
          <div class="aa-subtitle">${esc(truncAddr(data.walletAddress))} &middot; ${esc(data.positions.length)} position${data.positions.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div class="list-controls">
        <input type="text" class="list-filter-input" id="aa-pos-filter" placeholder="Search positions..." value="${esc(filterQuery)}">
        <select class="list-sort-select" id="aa-pos-sort">
          <option value="default">Default</option>
          <option value="yes-desc">YES (most)</option>
          <option value="no-desc">NO (most)</option>
          <option value="title-asc">Title (A-Z)</option>
        </select>
      </div>
      <div id="aa-positions-list">
        ${data.positions.length > 0 ? data.positions.map(renderPositionRow).join("") : `<div class="aa-empty">No positions found.</div>`}
      </div>
    </div>`;
}

function attachFilterHandlers() {
  const filterInput = root.querySelector("#aa-pos-filter") as HTMLInputElement | null;
  const sortSelect = root.querySelector("#aa-pos-sort") as HTMLSelectElement | null;

  if (filterInput) {
    filterInput.addEventListener("input", () => { filterQuery = filterInput.value; applyFilters(); });
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", () => { sortOrder = sortSelect.value; applyFilters(); });
  }
}

function renderLoading(): string {
  return `<div class="aa-card aa-loading"><div class="aa-loading-pulse"></div><div class="aa-loading-text">Loading positions...</div></div>`;
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

const app = new App({ name: "alpha-positions-widget", version: "1.0.0" });

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
  filterQuery = ""; sortOrder = "default";
  root.innerHTML = renderLoading();
};
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as PositionsStructuredContent | undefined;
  if (sc?.positionsData) {
    originalPositions = sc.positionsData.positions;
    root.innerHTML = renderPositions(sc.positionsData);
    attachFilterHandlers();
  } else {
    root.innerHTML = renderError("No position data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => { console.error("App error:", err); root.innerHTML = renderError("An error occurred."); };
app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
