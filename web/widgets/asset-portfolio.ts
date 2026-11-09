import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./asset-portfolio.css";

const ALLO_SVG = `<svg width="16" height="16" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

interface AssetPagination {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface AssetEntry {
  assetId: number;
  amount: number;
  isFrozen: boolean;
}

interface AssetPortfolioData {
  address: string;
  user: string;
  provider: string;
  assets: AssetEntry[];
  totalAssets: number;
  pagination?: AssetPagination;
}

interface AssetPortfolioStructuredContent {
  assetPortfolio: AssetPortfolioData;
}

// Known assets with decimals
const knownAssets: Record<number, { name: string; decimals: number }> = {
  0: { name: "ALGO", decimals: 6 },
  31566704: { name: "USDC", decimals: 6 },
  312769: { name: "USDt", decimals: 6 },
  386192725: { name: "goBTC", decimals: 8 },
  386195940: { name: "goETH", decimals: 8 },
};

// Track state for pagination
let currentData: AssetPortfolioData | null = null;
let isLoadingPage = false;

function formatAssetAmount(amount: number, assetId: number): string {
  const known = knownAssets[assetId];
  if (known) {
    return `${(amount / 10 ** known.decimals).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: known.decimals,
    })} ${known.name}`;
  }
  return amount.toLocaleString();
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function generatePageToken(page: number): string {
  return btoa(`page_${page}`);
}

function renderPortfolio(data: AssetPortfolioData): string {
  const totalAssets = data.totalAssets ?? data.assets?.length ?? 0;
  const pagination = data.pagination;

  const assetsHtml = data.assets.length > 0
    ? data.assets.map((a) => `
        <div class="ap-asset">
          <div class="ap-asset-top">
            <span class="ap-asset-id">${knownAssets[a.assetId]?.name ?? `ASA ${a.assetId}`}</span>
            ${a.isFrozen ? '<span class="ap-frozen-badge">Frozen</span>' : ""}
            <button class="allo-link" data-url="https://allo.info/asset/${a.assetId}" title="View on allo.info">${ALLO_SVG}</button>
          </div>
          <span class="ap-asset-amount">${formatAssetAmount(a.amount, a.assetId)}</span>
        </div>
      `).join("")
    : '<div class="ap-empty">No assets found</div>';

  const paginationHtml = pagination ? `
    <div class="ap-pagination">
      <button class="ap-page-btn${pagination.hasPrevPage ? "" : " disabled"}" id="ap-prev-page" ${pagination.hasPrevPage ? "" : "disabled"}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Prev
      </button>
      <span class="ap-page-info">${pagination.currentPage} / ${pagination.totalPages}</span>
      <button class="ap-page-btn${pagination.hasNextPage ? "" : " disabled"}" id="ap-next-page" ${pagination.hasNextPage ? "" : "disabled"}>
        Next
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>` : "";

  return `
    <div class="ap-card">
      <div class="ap-header">
        <div class="ap-header-top">
          <span class="ap-header-title">Asset Portfolio</span>
          <span class="ap-header-count">${totalAssets} asset${totalAssets !== 1 ? "s" : ""}</span>
        </div>
        <div class="ap-header-meta">
          <span class="ap-header-address" title="${data.address}">${truncateAddress(data.address)}</span>
          ${data.user ? `<span class="ap-header-user">${data.user}</span>` : ""}
          ${data.provider ? `<span class="ap-header-provider">${data.provider}</span>` : ""}
        </div>
      </div>

      <div class="ap-grid" id="ap-grid">
        ${assetsHtml}
      </div>

      ${paginationHtml}
    </div>
  `;
}

function renderLoading(label?: string): string {
  return `
    <div class="ap-card loading">
      <div class="ap-loading-pulse"></div>
      <div class="ap-loading-text">Loading ${label || "asset portfolio"}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="ap-card error">
      <div class="ap-error-icon">!</div>
      <div class="ap-error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers(data: AssetPortfolioData) {
  const pagination = data.pagination;
  if (!pagination) return;

  const prevBtn = root.querySelector("#ap-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#ap-next-page") as HTMLButtonElement | null;

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
  if (isLoadingPage) return;
  isLoadingPage = true;

  // Show loading state on the grid
  const grid = root.querySelector("#ap-grid");
  if (grid) {
    grid.innerHTML = `<div class="ap-grid-loading">Loading page ${page}...</div>`;
  }

  // Disable pagination buttons during load
  const prevBtn = root.querySelector("#ap-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#ap-next-page") as HTMLButtonElement | null;
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  try {
    const pageToken = generatePageToken(page);
    const result = await app.callServerTool({
      name: "wallet_get_assets",
      arguments: {
        pageToken,
      },
    });

    const sc = result.structuredContent as AssetPortfolioStructuredContent | undefined;
    if (sc?.assetPortfolio) {
      currentData = sc.assetPortfolio;
      root.innerHTML = renderPortfolio(sc.assetPortfolio);
      attachEventHandlers(sc.assetPortfolio);
    }
  } catch (err: any) {
    console.error("Failed to load asset page:", err);
    // Restore current view on error
    if (currentData) {
      root.innerHTML = renderPortfolio(currentData);
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

const app = new App({ name: "asset-portfolio-widget", version: "1.0.0" });

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
  root.innerHTML = renderLoading(args?.address ? `assets for ${truncateAddress(args.address)}` : undefined);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  if (args?.address) {
    root.innerHTML = renderLoading(`assets for ${truncateAddress(args.address)}`);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AssetPortfolioStructuredContent | undefined;
  if (sc?.assetPortfolio) {
    currentData = sc.assetPortfolio;
    root.innerHTML = renderPortfolio(sc.assetPortfolio);
    attachEventHandlers(sc.assetPortfolio);
  } else {
    root.innerHTML = renderError("No asset portfolio data returned.");
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
