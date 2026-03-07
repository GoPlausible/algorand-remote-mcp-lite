import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./account-search.css";

const ALLO_SVG = `<svg width="16" height="16" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

interface AccountResult {
  address: string;
  amount: number;
  totalAssetsOptedIn?: number;
  totalCreatedAssets?: number;
  status?: string;
}

interface AccountSearchData {
  accounts: AccountResult[];
  totalAccounts: number;
  nextToken: string | null;
  filters: {
    assetId?: number;
    applicationId?: number;
    currencyGreaterThan?: number;
    currencyLessThan?: number;
  };
}

interface AccountSearchStructuredContent {
  accountSearch: AccountSearchData;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function formatAlgo(microAlgos: number): string {
  const algos = microAlgos / 1_000_000;
  return algos.toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

function getStatusBadge(status?: string): string {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s === "online") {
    return `<span class="acs-status acs-status-online">Online</span>`;
  }
  return `<span class="acs-status acs-status-offline">${status}</span>`;
}

function renderFilterBadges(filters: AccountSearchData["filters"]): string {
  const badges: string[] = [];
  if (filters.assetId != null) {
    badges.push(`<span class="acs-filter-badge">Asset ${filters.assetId}</span>`);
  }
  if (filters.applicationId != null) {
    badges.push(`<span class="acs-filter-badge">App ${filters.applicationId}</span>`);
  }
  if (filters.currencyGreaterThan != null) {
    badges.push(`<span class="acs-filter-badge">&gt; ${formatAlgo(filters.currencyGreaterThan)} ALGO</span>`);
  }
  if (filters.currencyLessThan != null) {
    badges.push(`<span class="acs-filter-badge">&lt; ${formatAlgo(filters.currencyLessThan)} ALGO</span>`);
  }
  if (badges.length === 0) return "";
  return `<div class="acs-filters">${badges.join("")}</div>`;
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

function renderAccountRow(account: AccountResult, index: number): string {
  return `
    <tr class="acs-row${index % 2 === 1 ? " acs-row-alt" : ""}">
      <td class="acs-cell acs-cell-address">
        <span class="acs-address" title="${account.address}">${truncateAddress(account.address)}</span>
        <button class="acs-copy-btn" data-address="${account.address}" title="Copy address">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </td>
      <td class="acs-cell acs-cell-balance">${formatAlgo(account.amount)} ALGO</td>
      <td class="acs-cell acs-cell-assets">${account.totalAssetsOptedIn ?? 0}</td>
      <td class="acs-cell acs-cell-status">${getStatusBadge(account.status)}</td>
      <td class="acs-cell acs-cell-allo"><a class="allo-link" href="https://allo.info/account/${account.address}" target="_blank" rel="noopener" title="View on allo.info">${ALLO_SVG}</a></td>
    </tr>
  `;
}

function renderSearchResults(data: AccountSearchData): string {
  const filterHtml = renderFilterBadges(data.filters);

  const tableHtml = data.accounts.length > 0
    ? `
      <div class="acs-table-wrap">
        <table class="acs-table">
          <thead>
            <tr>
              <th class="acs-th">Address</th>
              <th class="acs-th">Balance</th>
              <th class="acs-th">Assets</th>
              <th class="acs-th">Status</th>
              <th class="acs-th"></th>
            </tr>
          </thead>
          <tbody>
            ${data.accounts.map((a, i) => renderAccountRow(a, i)).join("")}
          </tbody>
        </table>
      </div>`
    : `<div class="acs-empty">No accounts found matching the search criteria.</div>`;

  return `
    <div class="acs-card">
      <div class="acs-header">
        <div class="acs-header-label">Account Search Results</div>
        <div class="acs-header-count">${data.totalAccounts} account${data.totalAccounts !== 1 ? "s" : ""} found</div>
        ${filterHtml}
      </div>
      ${tableHtml}
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="acs-card loading">
      <div class="acs-loading-pulse"></div>
      <div class="acs-loading-text">Searching accounts...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="acs-card error">
      <div class="acs-error-icon">!</div>
      <div class="acs-error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers() {
  root.querySelectorAll<HTMLButtonElement>(".acs-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const address = btn.getAttribute("data-address");
      if (address) copyToClipboard(address, btn);
    });
  });
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

const app = new App({ name: "account-search-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AccountSearchStructuredContent | undefined;
  if (sc?.accountSearch) {
    root.innerHTML = renderSearchResults(sc.accountSearch);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No account search results returned.");
  }
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
