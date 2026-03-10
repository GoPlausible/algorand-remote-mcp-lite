import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./asset-search.css";

const ALLO_SVG = `<svg width="16" height="16" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

interface AssetResult {
  asset_id: number;
  name: string;
  unit_name: string;
  verification_tier: string;
  logo?: string;
  total_supply?: number;
  decimals?: number;
  creator_address?: string;
}

interface AssetPagination {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface SearchResultsData {
  query: string;
  assets: AssetResult[];
  totalResults: number;
  pagination?: AssetPagination;
}

interface AssetSearchStructuredContent {
  searchResults: SearchResultsData;
}

// Track state for pagination
let currentQuery: string | null = null;
let currentData: SearchResultsData | null = null;
let isLoadingPage = false;

// Filter/sort state
let originalAssets: AssetResult[] = [];
let asFilterQuery = "";
let asSortOrder = "default";
let asVerifFilter = "";

function generatePageToken(page: number): string {
  return btoa(`page_${page}`);
}

function getVerificationBadge(tier: string): string {
  const tierLower = tier.toLowerCase();
  if (tierLower === "verified" || tierLower === "trusted") {
    return `<span class="as-badge as-badge-verified">${tier}</span>`;
  }
  if (tierLower === "suspicious") {
    return `<span class="as-badge as-badge-suspicious">${tier}</span>`;
  }
  if (tierLower === "unverified") {
    return `<span class="as-badge as-badge-unverified">${tier}</span>`;
  }
  return `<span class="as-badge as-badge-unknown">${tier}</span>`;
}

function renderAssetRow(asset: AssetResult): string {
  const firstLetter = (asset.name || asset.unit_name || "?").charAt(0).toUpperCase();
  const logoHtml = asset.logo
    ? `<img class="as-logo-img" src="${asset.logo}" alt="${asset.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="as-logo-fallback" style="display:none">${firstLetter}</div>`
    : `<div class="as-logo-fallback">${firstLetter}</div>`;

  return `
    <div class="as-result-row">
      <div class="as-logo">${logoHtml}</div>
      <div class="as-info">
        <div class="as-name-row">
          <span class="as-name">${asset.name || "Unnamed Asset"}</span>
          ${asset.unit_name ? `<span class="as-unit">${asset.unit_name}</span>` : ""}
        </div>
        <span class="as-asset-id">ASA ${asset.asset_id}</span>
      </div>
      ${getVerificationBadge(asset.verification_tier)}
      <button class="allo-link" data-url="https://allo.info/asset/${asset.asset_id}" title="View on allo.info">${ALLO_SVG}</button>
    </div>
  `;
}

function applyAsFilters() {
  let filtered = originalAssets.slice();

  if (asFilterQuery) {
    const q = asFilterQuery.toLowerCase();
    filtered = filtered.filter((asset) => {
      return (asset.name || "").toLowerCase().includes(q) ||
        (asset.unit_name || "").toLowerCase().includes(q) ||
        String(asset.asset_id).includes(q);
    });
  }

  if (asVerifFilter) {
    filtered = filtered.filter((asset) => asset.verification_tier.toLowerCase() === asVerifFilter);
  }

  if (asSortOrder === "name-asc") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (asSortOrder === "name-desc") {
    filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
  } else if (asSortOrder === "id-asc") {
    filtered.sort((a, b) => a.asset_id - b.asset_id);
  }

  const listEl = root.querySelector("#as-results-list");
  if (!listEl) return;

  if (filtered.length > 0) {
    let html = "";
    for (const asset of filtered) {
      html += renderAssetRow(asset);
    }
    listEl.innerHTML = html;
  } else {
    listEl.innerHTML = `<div class="as-empty-filter">No assets match the current filter.</div>`;
  }
}

function renderSearchResults(data: SearchResultsData): string {
  const pagination = data.pagination;
  const paginationHtml = pagination ? `
    <div class="as-pagination">
      <button class="as-page-btn${pagination.hasPrevPage ? "" : " disabled"}" id="as-prev-page" ${pagination.hasPrevPage ? "" : "disabled"}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Prev
      </button>
      <span class="as-page-info">${pagination.currentPage} / ${pagination.totalPages}</span>
      <button class="as-page-btn${pagination.hasNextPage ? "" : " disabled"}" id="as-next-page" ${pagination.hasNextPage ? "" : "disabled"}>
        Next
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>` : "";

  const resultsHtml = data.assets.length > 0
    ? `<div class="as-results" id="as-results-list">${data.assets.map(renderAssetRow).join("")}</div>`
    : `<div class="as-empty">No assets found for "${data.query}".</div>`;

  return `
    <div class="as-card">
      <div class="as-header">
        <div class="as-header-query">Search Results</div>
        <div class="as-header-title">"${data.query}"</div>
        <div class="as-header-count">${data.totalResults} asset${data.totalResults !== 1 ? "s" : ""} found</div>
      </div>
      <div class="list-controls">
        <input type="text" class="list-filter-input" id="as-local-filter" placeholder="Filter results..." value="${asFilterQuery}">
        <select class="list-sort-select" id="as-verif-filter">
          <option value=""${asVerifFilter === "" ? " selected" : ""}>All tiers</option>
          <option value="verified"${asVerifFilter === "verified" ? " selected" : ""}>Verified</option>
          <option value="trusted"${asVerifFilter === "trusted" ? " selected" : ""}>Trusted</option>
          <option value="unverified"${asVerifFilter === "unverified" ? " selected" : ""}>Unverified</option>
        </select>
        <select class="list-sort-select" id="as-sort">
          <option value="default"${asSortOrder === "default" ? " selected" : ""}>Default order</option>
          <option value="name-asc"${asSortOrder === "name-asc" ? " selected" : ""}>Name (A-Z)</option>
          <option value="name-desc"${asSortOrder === "name-desc" ? " selected" : ""}>Name (Z-A)</option>
          <option value="id-asc"${asSortOrder === "id-asc" ? " selected" : ""}>ID (low &rarr; high)</option>
        </select>
      </div>
      ${resultsHtml}
      ${paginationHtml}
    </div>
  `;
}

function renderLoading(query?: string): string {
  return `
    <div class="as-card loading">
      <div class="as-loading-pulse"></div>
      <div class="as-loading-text">Searching${query ? ` for "${query}"` : ""}...</div>
    </div>
  `;
}

function renderNotFound(message: string): string {
  return `
    <div class="as-card as-not-found">
      <div class="as-nf-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          <path d="M8 11h6"/><path d="M11 8v6"/>
        </svg>
      </div>
      <div class="as-nf-title">No Results Found</div>
      <div class="as-nf-text">${message}</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="as-card error">
      <div class="as-error-icon">!</div>
      <div class="as-error-text">${message}</div>
    </div>
  `;
}

function attachAsFilterHandlers() {
  const filterInput = root.querySelector("#as-local-filter") as HTMLInputElement | null;
  const verifSelect = root.querySelector("#as-verif-filter") as HTMLSelectElement | null;
  const sortSelect = root.querySelector("#as-sort") as HTMLSelectElement | null;

  if (filterInput) {
    filterInput.value = asFilterQuery;
    filterInput.addEventListener("input", () => {
      asFilterQuery = filterInput.value;
      applyAsFilters();
    });
  }

  if (verifSelect) {
    verifSelect.value = asVerifFilter;
    verifSelect.addEventListener("change", () => {
      asVerifFilter = verifSelect.value;
      applyAsFilters();
    });
  }

  if (sortSelect) {
    sortSelect.value = asSortOrder;
    sortSelect.addEventListener("change", () => {
      asSortOrder = sortSelect.value;
      applyAsFilters();
    });
  }
}

function attachEventHandlers(data: SearchResultsData) {
  const pagination = data.pagination;
  if (!pagination || !currentQuery) return;

  const prevBtn = root.querySelector("#as-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#as-next-page") as HTMLButtonElement | null;

  if (prevBtn && pagination.hasPrevPage) {
    prevBtn.addEventListener("click", () => {
      if (isLoadingPage) return;
      loadPage(pagination.currentPage - 1);
    });
  }

  if (nextBtn && pagination.hasNextPage) {
    nextBtn.addEventListener("click", () => {
      if (isLoadingPage) return;
      loadPage(pagination.currentPage + 1);
    });
  }
}

async function loadPage(page: number) {
  if (!currentQuery || isLoadingPage) return;
  isLoadingPage = true;

  // Show loading state on the results list
  const resultsList = root.querySelector("#as-results-list");
  if (resultsList) {
    resultsList.innerHTML = `<div class="as-results-loading">Loading page ${page}...</div>`;
  }

  // Disable pagination buttons during load
  const prevBtn = root.querySelector("#as-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#as-next-page") as HTMLButtonElement | null;
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  try {
    const pageToken = generatePageToken(page);
    const result = await app.callServerTool({
      name: "pera_verified_assets_search",
      arguments: {
        query: currentQuery,
        pageToken,
      },
    });

    const sc = result.structuredContent as AssetSearchStructuredContent | undefined;
    if (sc?.searchResults) {
      currentData = sc.searchResults;
      originalAssets = sc.searchResults.assets;
      asFilterQuery = "";
      asVerifFilter = "";
      asSortOrder = "default";
      root.innerHTML = renderSearchResults(sc.searchResults);
      attachEventHandlers(sc.searchResults);
      attachAsFilterHandlers();
    }
  } catch (err: any) {
    console.error("Failed to load page:", err);
    // Restore current view on error
    if (currentData) {
      root.innerHTML = renderSearchResults(currentData);
      attachEventHandlers(currentData);
      attachAsFilterHandlers();
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

const app = new App({ name: "asset-search-widget", version: "1.0.0" });

// Handle allo.info link clicks via host navigation (postMessage to host)
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".allo-link");
  if (btn) {
    const url = btn.dataset.url;
    if (url) app.openLink({ url });
  }
});

app.ontoolinput = (params) => {
  const args = params.arguments as { query?: string } | undefined;
  asFilterQuery = "";
  asSortOrder = "default";
  asVerifFilter = "";
  root.innerHTML = renderLoading(args?.query);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { query?: string } | undefined;
  if (args?.query) {
    root.innerHTML = renderLoading(args.query);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AssetSearchStructuredContent | undefined;
  if (sc?.searchResults) {
    currentQuery = sc.searchResults.query;
    currentData = sc.searchResults;
    originalAssets = sc.searchResults.assets;
    root.innerHTML = renderSearchResults(sc.searchResults);
    attachEventHandlers(sc.searchResults);
    attachAsFilterHandlers();
  } else {
    root.innerHTML = renderNotFound("Try a different keyword or check the asset name.");
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
