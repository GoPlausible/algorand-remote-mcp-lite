import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./nfd-card.css";

interface AssetPagination {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface NfdAccountData {
  nfdName: string;
  avatar: string | null;
  address: string;
  amount: number;
  assets: Array<{ assetId: number; amount: number }>;
  totalAssets: number;
  showAssets?: boolean;
  assetPagination?: AssetPagination;
  category: string | null;
  state: string | null;
  owner: string | null;
  tags: string[];
  bio: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  linkedin: string | null;
}

interface NfdStructuredContent {
  nfdAccount: NfdAccountData;
}

// Track state for pagination
let currentNfdName: string | null = null;
let currentData: NfdAccountData | null = null;
let isLoadingPage = false;

function formatAlgo(microAlgos: number): string {
  return (microAlgos / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
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

function twitterUrl(handle: string): string {
  const clean = handle.replace(/^@/, "");
  return `https://x.com/${clean}`;
}

function websiteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function buildSocialButtons(data: NfdAccountData): string {
  const buttons: string[] = [];
  if (data.twitter) {
    const label = data.twitter.replace(/^@/, "");
    buttons.push(
      `<button class="social-btn social-twitter" data-url="${twitterUrl(data.twitter)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.636 5.905-5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        @${label}
      </button>`
    );
  }
  if (data.linkedin) {
    const clean = data.linkedin.replace(/^\/in\//i, "");
    buttons.push(
      `<button class="social-btn social-linkedin" data-url="https://linkedin.com/in/${clean}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        ${clean}
      </button>`
    );
  }
  if (data.discord) {
    buttons.push(
      `<button class="social-btn social-discord" data-url="https://discord.com">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        ${data.discord}
      </button>`
    );
  }
  if (data.website) {
    const url = websiteUrl(data.website);
    let label = data.website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (label.length > 28) label = `${label.slice(0, 26)}…`;
    buttons.push(
      `<button class="social-btn social-website" data-url="${url}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        ${label}
      </button>`
    );
  }
  return buttons.length
    ? `<div class="nfd-socials">${buttons.join("")}</div>`
    : "";
}

function renderNfdCard(data: NfdAccountData): string {
  const algoBalance = formatAlgo(data.amount);
  const totalAssets = data.totalAssets ?? data.assets?.length ?? 0;
  const avatarHtml = data.avatar
    ? `<img class="nfd-avatar-img" src="${data.avatar}" alt="${data.nfdName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="nfd-avatar-fallback" style="display:none">${data.nfdName.charAt(0).toUpperCase()}</div>`
    : `<div class="nfd-avatar-fallback">${data.nfdName.charAt(0).toUpperCase()}</div>`;

  const socialsHtml = buildSocialButtons(data);

  const tagsHtml = data.tags?.length
    ? `<div class="nfd-tags">${data.tags.map((t) => `<span class="nfd-tag">${t}</span>`).join("")}</div>`
    : "";

  const pagination = data.assetPagination;
  const paginationHtml = pagination ? `
        <div class="nfd-pagination">
          <button class="nfd-page-btn${pagination.hasPrevPage ? "" : " disabled"}" id="nfd-prev-page" ${pagination.hasPrevPage ? "" : "disabled"}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Prev
          </button>
          <span class="nfd-page-info">${pagination.currentPage} / ${pagination.totalPages}</span>
          <button class="nfd-page-btn${pagination.hasNextPage ? "" : " disabled"}" id="nfd-next-page" ${pagination.hasNextPage ? "" : "disabled"}>
            Next
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>` : "";

  // Sort assets descending by amount (most balance first)
  const sortedAssets = [...(data.assets ?? [])].sort((a, b) => b.amount - a.amount);

  return `
    <div class="nfd-card">
      <div class="nfd-hero">
        <div class="nfd-avatar">${avatarHtml}</div>
        <div class="nfd-identity">
          <h2 class="nfd-name">${data.nfdName}</h2>
          ${data.bio ? `<p class="nfd-bio">${data.bio}</p>` : ""}
          <div class="nfd-badges">
            ${data.state ? `<span class="nfd-badge nfd-badge-state">${data.state}</span>` : ""}
            ${data.category ? `<span class="nfd-badge nfd-badge-category">${data.category}</span>` : ""}
          </div>
        </div>
      </div>

      ${tagsHtml}

      ${socialsHtml}

      <div class="nfd-balance-section">
        <div class="nfd-balance-label">Balance</div>
        <div class="nfd-balance-value">
          <span class="nfd-balance-amount">${algoBalance}</span>
          <span class="nfd-balance-unit">ALGO</span>
        </div>
      </div>

      <div class="nfd-details">
        <div class="nfd-detail-row nfd-clickable" data-url="https://allo.info/address/${data.address}">
          <span class="nfd-detail-label">Address</span>
          <span class="nfd-detail-value nfd-address nfd-link" title="${data.address}">${truncateAddress(data.address)} ↗</span>
        </div>
        ${data.owner && data.owner !== data.address ? `
        <div class="nfd-detail-row nfd-clickable" data-url="https://allo.info/address/${data.owner}">
          <span class="nfd-detail-label">Owner</span>
          <span class="nfd-detail-value nfd-address nfd-link" title="${data.owner}">${truncateAddress(data.owner)} ↗</span>
        </div>` : ""}
        <div class="nfd-detail-row">
          <span class="nfd-detail-label">Assets</span>
          <span class="nfd-detail-value">${totalAssets} asset${totalAssets !== 1 ? "s" : ""} opted in</span>
        </div>
      </div>

      ${data.showAssets && sortedAssets.length > 0 ? `
      <div class="nfd-assets-section">
        <div class="nfd-assets-header">
          <span class="nfd-assets-title">Assets (${totalAssets})</span>
        </div>
        <div class="nfd-assets-list" id="nfd-assets-list">
          ${sortedAssets
            .filter((a) => a.amount > 0)
            .map((a) => `
              <div class="nfd-asset-row nfd-clickable" data-url="https://allo.info/asset/${a.assetId}">
                <span class="nfd-asset-id">ASA ${a.assetId} ↗</span>
                <span class="nfd-asset-amount">${formatAssetAmount(a.amount, a.assetId)}</span>
              </div>
            `).join("")}
        </div>
        ${paginationHtml}
      </div>` : ""}

      <button class="nfd-copy-btn" data-address="${data.address}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        Copy Address
      </button>
    </div>
  `;
}

function renderLoading(name?: string): string {
  return `
    <div class="nfd-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">Looking up ${name || "NFD"}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="nfd-card error">
      <div class="error-icon">!</div>
      <div class="error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers(data: NfdAccountData) {
  // Social buttons and clickable rows — open external links
  for (const el of root.querySelectorAll<HTMLElement>(".social-btn, .nfd-clickable")) {
    const url = el.dataset.url;
    if (url) {
      el.addEventListener("click", () => { app.openLink(url); });
    }
  }

  // Copy button
  const copyBtn = root.querySelector(".nfd-copy-btn") as HTMLButtonElement | null;
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const addr = copyBtn.dataset.address || "";
      navigator.clipboard.writeText(addr).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            Copy Address
          `;
        }, 2000);
      });
    });
  }

  // Pagination buttons
  const pagination = data.assetPagination;
  if (!pagination || !currentNfdName) return;

  const prevBtn = root.querySelector("#nfd-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#nfd-next-page") as HTMLButtonElement | null;

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
  if (!currentNfdName || isLoadingPage) return;
  isLoadingPage = true;

  // Show loading state on the assets list
  const assetsList = root.querySelector("#nfd-assets-list");
  if (assetsList) {
    assetsList.innerHTML = `<div class="nfd-assets-loading">Loading page ${page}...</div>`;
  }

  // Disable pagination buttons during load
  const prevBtn = root.querySelector("#nfd-prev-page") as HTMLButtonElement | null;
  const nextBtn = root.querySelector("#nfd-next-page") as HTMLButtonElement | null;
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  try {
    const pageToken = generatePageToken(page);
    const result = await app.callServerTool({
      name: "api_nfd_get_nfd",
      arguments: {
        name: currentNfdName,
        view: "full",
        pageToken,
      },
    });

    const sc = result.structuredContent as NfdStructuredContent | undefined;
    if (sc?.nfdAccount) {
      currentData = sc.nfdAccount;
      root.innerHTML = renderNfdCard(sc.nfdAccount);
      attachEventHandlers(sc.nfdAccount);
    }
  } catch (err: any) {
    console.error("Failed to load asset page:", err);
    // Restore current view on error
    if (currentData) {
      root.innerHTML = renderNfdCard(currentData);
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

const app = new App({ name: "nfd-card-widget", version: "1.0.0" });

app.ontoolinput = (params) => {
  const args = params.arguments as { name?: string } | undefined;
  root.innerHTML = renderLoading(args?.name);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { name?: string } | undefined;
  if (args?.name) {
    root.innerHTML = renderLoading(args.name);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as NfdStructuredContent | undefined;
  if (sc?.nfdAccount) {
    currentNfdName = sc.nfdAccount.nfdName;
    currentData = sc.nfdAccount;
    root.innerHTML = renderNfdCard(sc.nfdAccount);
    attachEventHandlers(sc.nfdAccount);
  } else {
    root.innerHTML = renderError("NFD not found or no account data returned.");
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
