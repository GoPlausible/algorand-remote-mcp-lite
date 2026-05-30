import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./account-card.css";

interface AssetPagination {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface AccountDashboardData {
  address: string;
  amount: number;
  minBalance: number;
  status: string;
  authAddr?: string;
  totalAssets: number;
  totalApps: number;
  totalCreatedAssets: number;
  totalCreatedApps: number;
  assets: Array<{ assetId: number; amount: number }>;
  assetPagination?: AssetPagination;
}

interface AccountStructuredContent {
  accountDashboard: AccountDashboardData;
}

// Track state for pagination
let currentAddress: string | null = null;
let currentData: AccountDashboardData | null = null;
let isLoadingPage = false;

function formatAlgo(microAlgos: number): string {
  return (microAlgos / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function truncateAddress(addr: unknown): string {
  // Defensive: structuredContent may carry non-string address values (e.g. an
  // algosdk Address object serialized to {publicKey:{...}}). Coerce so a bad
  // value degrades gracefully instead of throwing and blanking the whole card.
  const s = typeof addr === "string" ? addr : addr == null ? "" : String(addr);
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}...${s.slice(-8)}`;
}

function formatAssetAmount(amount: number, assetId: number): string {
  const knownDecimals: Record<number, { name: string; decimals: number }> = {
    0: { name: "ALGO", decimals: 6 },
    31566704: { name: "USDC", decimals: 6 },
    312769: { name: "USDt", decimals: 6 },
    386192725: { name: "goBTC", decimals: 8 },
    386195940: { name: "goETH", decimals: 8 },
    793124631: { name: "VEST", decimals: 6 },
  };
  const known = knownDecimals[assetId];
  if (known) {
    return `${(amount / 10 ** known.decimals).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: known.decimals })} ${known.name}`;
  }
  return amount.toLocaleString();
}

function generatePageToken(page: number): string {
  return btoa(`page_${page}`);
}

function getStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case "online":
      return "status-online";
    case "offline":
      return "status-offline";
    case "notparticipating":
      return "status-notparticipating";
    default:
      return "status-offline";
  }
}

function getStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "notparticipating":
      return "Not Participating";
    default:
      return status;
  }
}

function renderAccountCard(data: AccountDashboardData): string {
  const algoBalance = formatAlgo(data.amount);
  const minBalance = formatAlgo(data.minBalance);
  const available = data.amount - data.minBalance;
  const availableAlgo = formatAlgo(Math.max(0, available));
  const usagePercent = data.amount > 0 ? Math.min(100, (data.minBalance / data.amount) * 100) : 0;

  const statusClass = getStatusClass(data.status);
  const statusLabel = getStatusLabel(data.status);

  const rekeyHtml = data.authAddr
    ? `<div class="acct-rekey-warning">
        <div class="acct-rekey-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="acct-rekey-content">
          <span class="acct-rekey-label">Rekeyed to</span>
          <span class="acct-rekey-addr" title="${data.authAddr}">${truncateAddress(data.authAddr)}</span>
        </div>
      </div>`
    : "";

  const pagination = data.assetPagination;
  const paginationHtml = pagination
    ? `<div class="acct-pagination">
        <button class="acct-page-btn${pagination.hasPrevPage ? "" : " disabled"}" id="acct-prev-page" ${pagination.hasPrevPage ? "" : "disabled"}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Prev
        </button>
        <span class="acct-page-info">${pagination.currentPage} / ${pagination.totalPages}</span>
        <button class="acct-page-btn${pagination.hasNextPage ? "" : " disabled"}" id="acct-next-page" ${pagination.hasNextPage ? "" : "disabled"}>
          Next
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`
    : "";

  return `
    <div class="acct-card">
      <div class="acct-header">
        <div class="acct-address-row">
          <span class="acct-address" title="${data.address}">${truncateAddress(data.address)}</span>
          <button class="acct-copy-btn" data-address="${data.address}" title="Copy address">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
        </div>
        <span class="acct-status-badge ${statusClass}">${statusLabel}</span>
      </div>

      <div class="acct-balance-section">
        <div class="acct-balance-label">Balance</div>
        <div class="acct-balance-value">
          <span class="acct-balance-amount">${algoBalance}</span>
          <span class="acct-balance-unit">ALGO</span>
        </div>
      </div>

      ${rekeyHtml}

      <div class="acct-minbal-section">
        <div class="acct-minbal-header">
          <span class="acct-minbal-label">Available Balance</span>
          <span class="acct-minbal-value">${availableAlgo} ALGO</span>
        </div>
        <div class="acct-minbal-bar">
          <div class="acct-minbal-used" style="width: ${usagePercent}%"></div>
        </div>
        <div class="acct-minbal-footer">
          <span class="acct-minbal-hint">Min balance: ${minBalance} ALGO</span>
          <span class="acct-minbal-hint">${usagePercent.toFixed(1)}% reserved</span>
        </div>
      </div>

      <div class="acct-stats-grid">
        <div class="acct-stat">
          <span class="acct-stat-value">${data.totalAssets}</span>
          <span class="acct-stat-label">Assets</span>
        </div>
        <div class="acct-stat">
          <span class="acct-stat-value">${data.totalApps}</span>
          <span class="acct-stat-label">Apps</span>
        </div>
        <div class="acct-stat">
          <span class="acct-stat-value">${data.totalCreatedAssets}</span>
          <span class="acct-stat-label">Created Assets</span>
        </div>
        <div class="acct-stat">
          <span class="acct-stat-value">${data.totalCreatedApps}</span>
          <span class="acct-stat-label">Created Apps</span>
        </div>
      </div>

      ${data.assets && data.assets.length > 0 ? `
      <div class="acct-assets-section">
        <div class="acct-assets-header">
          <span class="acct-assets-title">Assets (${data.totalAssets})</span>
        </div>
        <div class="acct-assets-list" id="acct-assets-list">
          ${data.assets
            .map(
              (a) => `
              <div class="acct-asset-row">
                <span class="acct-asset-id">ASA ${a.assetId}</span>
                <span class="acct-asset-amount">${formatAssetAmount(a.amount, a.assetId)}</span>
              </div>
            `
            )
            .join("")}
        </div>
        ${paginationHtml}
      </div>` : ""}
    </div>
  `;
}

function renderLoading(address?: string): string {
  return `
    <div class="acct-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">Loading account${address ? ` ${truncateAddress(address)}` : ""}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="acct-card error">
      <div class="error-icon">!</div>
      <div class="error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers(data: AccountDashboardData) {
  // Copy button
  const copyBtn = root.querySelector(".acct-copy-btn") as HTMLButtonElement | null;
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const addr = copyBtn.dataset.address || "";
      navigator.clipboard.writeText(addr).then(() => {
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          `;
        }, 2000);
      });
    });
  }

  // Pagination buttons
  const pagination = data.assetPagination;
  if (!pagination || !currentAddress) return;

  const prevBtn = root.querySelector("#acct-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#acct-next-page") as HTMLButtonElement | null;

  if (prevBtn && pagination.hasPrevPage) {
    prevBtn.addEventListener("click", () => {
      if (isLoadingPage) return;
      loadAssetPage(pagination.currentPage - 1);
    });
  }

  if (nextBtn && pagination.hasNextPage) {
    nextBtn.addEventListener("click", () => {
      if (isLoadingPage) return;
      loadAssetPage(pagination.currentPage + 1);
    });
  }
}

async function loadAssetPage(page: number) {
  if (!currentAddress || isLoadingPage) return;
  isLoadingPage = true;

  // Show loading state on the assets list
  const assetsList = root.querySelector("#acct-assets-list");
  if (assetsList) {
    assetsList.innerHTML = `<div class="acct-assets-loading">Loading page ${page}...</div>`;
  }

  // Disable pagination buttons during load
  const prevBtn = root.querySelector("#acct-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#acct-next-page") as HTMLButtonElement | null;
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  try {
    const pageToken = generatePageToken(page);
    const result = await app.callServerTool({
      name: "algod_get_account_info",
      arguments: {
        address: currentAddress,
        pageToken,
      },
    });

    const sc = result.structuredContent as AccountStructuredContent | undefined;
    if (sc?.accountDashboard) {
      currentData = sc.accountDashboard;
      root.innerHTML = renderAccountCard(sc.accountDashboard);
      attachEventHandlers(sc.accountDashboard);
    }
  } catch (err: any) {
    console.error("Failed to load asset page:", err);
    // Restore current view on error
    if (currentData) {
      root.innerHTML = renderAccountCard(currentData);
      attachEventHandlers(currentData);
    }
  } finally {
    isLoadingPage = false;
  }
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

const app = new App({ name: "account-card-widget", version: "1.0.0" });

app.ontoolinput = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  root.innerHTML = renderLoading(args?.address);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  if (args?.address) {
    root.innerHTML = renderLoading(args.address);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AccountStructuredContent | undefined;
  if (sc?.accountDashboard) {
    currentAddress = sc.accountDashboard.address;
    currentData = sc.accountDashboard;
    root.innerHTML = renderAccountCard(sc.accountDashboard);
    attachEventHandlers(sc.accountDashboard);
  } else {
    root.innerHTML = renderError("Account not found or no data returned.");
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
