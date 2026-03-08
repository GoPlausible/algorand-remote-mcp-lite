import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./asset-holders.css";

const ALLO_SVG = `<svg width="16" height="16" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

interface BalanceEntry {
  address: string;
  amount: bigint;
  isFrozen: boolean;
}

interface AssetHoldersData {
  assetId: number;
  balances: BalanceEntry[];
  totalHolders: number;
  nextToken: string | null;
}

interface AssetHoldersStructuredContent {
  assetHolders?: AssetHoldersData;
  // Allow flat structure as well
  assetId?: number;
  balances?: BalanceEntry[];
  totalHolders?: number;
  nextToken?: string | null;
}

// Filter/sort state
let originalBalances: BalanceEntry[] = [];
let ahFilterQuery = "";
let ahFrozenFilter = "";
let ahSortOrder = "amount-desc";

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function formatAmount(amount: bigint | number | string): string {
  return BigInt(amount).toLocaleString();
}

function extractData(sc: AssetHoldersStructuredContent): AssetHoldersData | null {
  if (sc.assetHolders) return sc.assetHolders;
  if (sc.assetId !== undefined && sc.balances) {
    return {
      assetId: sc.assetId,
      balances: sc.balances,
      totalHolders: sc.totalHolders ?? sc.balances.length,
      nextToken: sc.nextToken ?? null,
    };
  }
  return null;
}

function copyToClipboard(text: string, btn: HTMLElement) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.innerHTML = original;
    }, 1500);
  });
}

function renderBalanceRows(balances: BalanceEntry[]): string {
  if (balances.length === 0) {
    return `<tr><td class="ah-empty" colspan="4">No holders match the current filter.</td></tr>`;
  }
  let html = "";
  for (let idx = 0; idx < balances.length; idx++) {
    const entry = balances[idx];
    html += `
      <tr class="ah-row${idx % 2 === 1 ? " ah-row-alt" : ""}">
        <td class="ah-cell ah-cell-address">
          <span class="ah-address" title="${entry.address}">${truncateAddress(entry.address)}</span>
          <button class="ah-copy-btn" data-address="${entry.address}" title="Copy address">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </td>
        <td class="ah-cell ah-cell-amount">${formatAmount(entry.amount)}</td>
        <td class="ah-cell ah-cell-frozen">
          ${entry.isFrozen ? '<span class="ah-frozen-badge ah-frozen-yes">Frozen</span>' : '<span class="ah-frozen-badge ah-frozen-no">No</span>'}
        </td>
        <td class="ah-cell ah-cell-allo"><button class="allo-link" data-url="https://allo.info/account/${entry.address}" title="View on allo.info">${ALLO_SVG}</button></td>
      </tr>`;
  }
  return html;
}

function applyAhFilters() {
  let filtered = originalBalances.slice();

  if (ahFilterQuery) {
    const q = ahFilterQuery.toLowerCase();
    filtered = filtered.filter((entry) => entry.address.toLowerCase().includes(q));
  }

  if (ahFrozenFilter === "frozen") {
    filtered = filtered.filter((entry) => entry.isFrozen);
  } else if (ahFrozenFilter === "active") {
    filtered = filtered.filter((entry) => !entry.isFrozen);
  }

  if (ahSortOrder === "amount-desc") {
    filtered.sort((a, b) => (a.amount > b.amount ? -1 : 1));
  } else if (ahSortOrder === "amount-asc") {
    filtered.sort((a, b) => (a.amount > b.amount ? 1 : -1));
  } else if (ahSortOrder === "addr-asc") {
    filtered.sort((a, b) => a.address.localeCompare(b.address));
  }

  const tbody = root.querySelector("#ah-table tbody");
  if (!tbody) return;
  tbody.innerHTML = renderBalanceRows(filtered);

  attachCopyHandlers();
}

function renderHoldersTable(data: AssetHoldersData): string {
  const rows = renderBalanceRows(data.balances);

  return `
    <div class="ah-card">
      <div class="ah-header">
        <div class="ah-header-top">
          <h2 class="ah-title">Asset #${data.assetId} Holders</h2>
          <span class="ah-count">${data.totalHolders.toLocaleString()} holder${data.totalHolders !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div class="list-controls">
        <input type="text" class="list-filter-input" id="ah-filter" placeholder="Filter by address..." value="${ahFilterQuery}">
        <select class="list-sort-select" id="ah-frozen-filter">
          <option value=""${ahFrozenFilter === "" ? " selected" : ""}>All</option>
          <option value="frozen"${ahFrozenFilter === "frozen" ? " selected" : ""}>Frozen only</option>
          <option value="active"${ahFrozenFilter === "active" ? " selected" : ""}>Active only</option>
        </select>
        <select class="list-sort-select" id="ah-sort">
          <option value="amount-desc"${ahSortOrder === "amount-desc" ? " selected" : ""}>Amount (high)</option>
          <option value="amount-asc"${ahSortOrder === "amount-asc" ? " selected" : ""}>Amount (low)</option>
          <option value="addr-asc"${ahSortOrder === "addr-asc" ? " selected" : ""}>Address (A-Z)</option>
        </select>
      </div>
      <div class="ah-table-wrap">
        <table class="ah-table" id="ah-table">
          <thead>
            <tr>
              <th class="ah-th">Address</th>
              <th class="ah-th ah-th-amount">Amount</th>
              <th class="ah-th ah-th-frozen">Frozen</th>
              <th class="ah-th"></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderLoading(assetId?: number): string {
  return `
    <div class="ah-card ah-loading">
      <div class="ah-loading-pulse"></div>
      <div class="ah-loading-text">Loading holders${assetId ? ` for asset #${assetId}` : ""}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="ah-card ah-error">
      <div class="ah-error-icon">!</div>
      <div class="ah-error-text">${message}</div>
    </div>
  `;
}

function attachCopyHandlers() {
  const copyBtns = root.querySelectorAll(".ah-copy-btn");
  for (const btn of Array.from(copyBtns)) {
    btn.addEventListener("click", () => {
      const address = (btn as HTMLElement).dataset.address;
      if (address) {
        copyToClipboard(address, btn as HTMLElement);
      }
    });
  }
}

function attachAhFilterHandlers() {
  const filterInput = root.querySelector("#ah-filter") as HTMLInputElement | null;
  const frozenSelect = root.querySelector("#ah-frozen-filter") as HTMLSelectElement | null;
  const sortSelect = root.querySelector("#ah-sort") as HTMLSelectElement | null;

  if (filterInput) {
    filterInput.value = ahFilterQuery;
    filterInput.addEventListener("input", () => {
      ahFilterQuery = filterInput.value;
      applyAhFilters();
    });
  }

  if (frozenSelect) {
    frozenSelect.value = ahFrozenFilter;
    frozenSelect.addEventListener("change", () => {
      ahFrozenFilter = frozenSelect.value;
      applyAhFilters();
    });
  }

  if (sortSelect) {
    sortSelect.value = ahSortOrder;
    sortSelect.addEventListener("change", () => {
      ahSortOrder = sortSelect.value;
      applyAhFilters();
    });
  }
}

function attachEventHandlers() {
  attachCopyHandlers();
  attachAhFilterHandlers();
}

// --- App lifecycle ---

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

const app = new App({ name: "asset-holders-widget", version: "1.0.0" });

// Handle allo.info link clicks via host navigation (postMessage to host)
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".allo-link");
  if (btn) {
    const url = btn.dataset.url;
    if (url) app.openLink({ url });
  }
});

app.ontoolinput = (params) => {
  const args = params.arguments as { assetId?: number } | undefined;
  ahFilterQuery = "";
  ahFrozenFilter = "";
  ahSortOrder = "amount-desc";
  root.innerHTML = renderLoading(args?.assetId);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { assetId?: number } | undefined;
  if (args?.assetId) {
    root.innerHTML = renderLoading(args.assetId);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AssetHoldersStructuredContent | undefined;
  if (sc) {
    const data = extractData(sc);
    if (data) {
      originalBalances = data.balances;
      root.innerHTML = renderHoldersTable(data);
      attachEventHandlers();
      return;
    }
  }
  root.innerHTML = renderError("No asset holder data returned.");
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
