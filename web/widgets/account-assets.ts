import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./account-assets.css";

const ALLO_SVG = `<svg width="16" height="16" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

interface AccountAsset {
  assetId: bigint;
  amount: bigint;
  isFrozen: boolean;
}

interface AccountAssetsData {
  address: string;
  assets: AccountAsset[];
  totalAssets: number;
  'next-token': string | null;
}

interface AccountAssetsStructuredContent {
  accountAssets?: AccountAssetsData;
  // Allow flat structure as well
  address?: string;
  assets?: AccountAsset[];
  totalAssets?: number;
  'next-token'?: string | null;
}

// Filter/sort state
let originalAssets: AccountAsset[] = [];
let aaFilterQuery = "";
let aaSortOrder = "id-asc";

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function extractData(sc: AccountAssetsStructuredContent): AccountAssetsData | null {
  if (sc.accountAssets) return sc.accountAssets;
  if (sc.address && sc.assets) {
    return {
      address: sc.address,
      assets: sc.assets,
      totalAssets: sc.totalAssets ?? sc.assets.length,
      'next-token': sc['next-token'] ?? null,
    };
  }
  return null;
}

function renderAssetRows(assets: AccountAsset[]): string {
  if (assets.length === 0) {
    return `<tr><td colspan="4" class="aa-empty">No assets match the current filter.</td></tr>`;
  }
  let html = "";
  for (let index = 0; index < assets.length; index++) {
    const asset = assets[index];
    const frozenHtml = asset.isFrozen
      ? '<span class="aa-frozen-badge aa-frozen-yes">Frozen</span>'
      : '<span class="aa-frozen-badge aa-frozen-no">--</span>';

    html += `
      <tr class="aa-table-row${index % 2 === 1 ? " aa-row-alt" : ""}">
        <td class="aa-cell aa-cell-id">${String(asset.assetId)}</td>
        <td class="aa-cell aa-cell-amount">${String(asset.amount)}</td>
        <td class="aa-cell aa-cell-frozen">${frozenHtml}</td>
        <td class="aa-cell aa-cell-allo"><button class="allo-link" data-url="https://allo.info/asset/${String(asset.assetId)}" title="View on allo.info">${ALLO_SVG}</button></td>
      </tr>
    `;
  }
  return html;
}

function applyAaFilters() {
  let filtered = originalAssets.slice();

  if (aaFilterQuery) {
    const q = aaFilterQuery.toLowerCase();
    filtered = filtered.filter((asset) => String(asset.assetId).includes(q));
  }

  if (aaSortOrder === "id-asc") {
    filtered.sort((a, b) => (Number(a.assetId) - Number(b.assetId)));
  } else if (aaSortOrder === "id-desc") {
    filtered.sort((a, b) => (Number(b.assetId) - Number(a.assetId)));
  } else if (aaSortOrder === "amount-desc") {
    filtered.sort((a, b) => (Number(b.amount) - Number(a.amount)));
  } else if (aaSortOrder === "amount-asc") {
    filtered.sort((a, b) => (Number(a.amount) - Number(b.amount)));
  }

  const tbody = root.querySelector("#aa-table tbody");
  if (!tbody) return;
  tbody.innerHTML = renderAssetRows(filtered);
}

function renderAccountAssets(data: AccountAssetsData): string {
  const assetRows = data.assets.length > 0
    ? renderAssetRows(data.assets)
    : `<tr><td colspan="4" class="aa-empty">No assets found for this account.</td></tr>`;

  return `
    <div class="aa-card">
      <div class="aa-header">
        <div class="aa-header-top">
          <h2 class="aa-title">Account Assets</h2>
          <span class="aa-count">${data.totalAssets.toLocaleString()} asset${data.totalAssets !== 1 ? "s" : ""}</span>
        </div>
        <div class="aa-address-row">
          <span class="aa-address" title="${data.address}">${truncateAddress(data.address)}</span>
        </div>
      </div>
      <div class="list-controls">
        <input type="text" class="list-filter-input" id="aa-filter" placeholder="Filter by Asset ID..." value="${aaFilterQuery}">
        <select class="list-sort-select" id="aa-sort">
          <option value="id-asc"${aaSortOrder === "id-asc" ? " selected" : ""}>ID (low &rarr; high)</option>
          <option value="id-desc"${aaSortOrder === "id-desc" ? " selected" : ""}>ID (high &rarr; low)</option>
          <option value="amount-desc"${aaSortOrder === "amount-desc" ? " selected" : ""}>Amount (high &rarr; low)</option>
          <option value="amount-asc"${aaSortOrder === "amount-asc" ? " selected" : ""}>Amount (low &rarr; high)</option>
        </select>
      </div>
      <div class="aa-table-wrapper">
        <table class="aa-table" id="aa-table">
          <thead>
            <tr class="aa-table-head-row">
              <th class="aa-th">Asset ID</th>
              <th class="aa-th">Amount</th>
              <th class="aa-th">Frozen</th>
              <th class="aa-th"></th>
            </tr>
          </thead>
          <tbody>
            ${assetRows}
          </tbody>
        </table>
      </div>
      ${data['next-token'] ? '<div class="aa-more-indicator">More assets available</div>' : ""}
    </div>
  `;
}

function renderLoading(address?: string): string {
  return `
    <div class="aa-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">Loading assets${address ? ` for ${truncateAddress(address)}` : ""}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="aa-card error">
      <div class="error-icon">!</div>
      <div class="error-text">${message}</div>
    </div>
  `;
}

function attachAaFilterHandlers() {
  const filterInput = root.querySelector("#aa-filter") as HTMLInputElement | null;
  const sortSelect = root.querySelector("#aa-sort") as HTMLSelectElement | null;

  if (filterInput) {
    filterInput.value = aaFilterQuery;
    filterInput.addEventListener("input", () => {
      aaFilterQuery = filterInput.value;
      applyAaFilters();
    });
  }

  if (sortSelect) {
    sortSelect.value = aaSortOrder;
    sortSelect.addEventListener("change", () => {
      aaSortOrder = sortSelect.value;
      applyAaFilters();
    });
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

const app = new App({ name: "account-assets-widget", version: "1.0.0" });

// Handle allo.info link clicks via host navigation (postMessage to host)
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".allo-link");
  if (btn) {
    const url = btn.dataset.url;
    if (url) app.openLink({ url });
  }
});

app.ontoolinput = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  aaFilterQuery = "";
  aaSortOrder = "id-asc";
  root.innerHTML = renderLoading(args?.address);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  if (args?.address) {
    root.innerHTML = renderLoading(args.address);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AccountAssetsStructuredContent | undefined;
  if (sc) {
    const data = extractData(sc);
    if (data) {
      originalAssets = data.assets;
      root.innerHTML = renderAccountAssets(data);
      attachAaFilterHandlers();
      return;
    }
  }
  root.innerHTML = renderError("No asset data returned.");
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
