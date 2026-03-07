import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./nfd-card.css";

interface NfdAccountData {
  nfdName: string;
  avatar: string | null;
  address: string;
  amount: number;
  assets: Array<{ assetId: number; amount: number }>;
  showAssets?: boolean;
  category: string | null;
  state: string | null;
  owner: string | null;
  tags: string[];
  bio: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
}

interface NfdStructuredContent {
  nfdAccount: NfdAccountData;
}

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
  // Well-known assets with known decimals
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
  // For unknown assets, show raw amount
  return amount.toLocaleString();
}

function renderNfdCard(data: NfdAccountData): string {
  const algoBalance = formatAlgo(data.amount);
  const assetCount = data.assets?.length || 0;
  const avatarHtml = data.avatar
    ? `<img class="nfd-avatar-img" src="${data.avatar}" alt="${data.nfdName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="nfd-avatar-fallback" style="display:none">${data.nfdName.charAt(0).toUpperCase()}</div>`
    : `<div class="nfd-avatar-fallback">${data.nfdName.charAt(0).toUpperCase()}</div>`;

  const socialLinks: string[] = [];
  if (data.twitter) socialLinks.push(`<a class="social-link" title="Twitter">@${data.twitter}</a>`);
  if (data.discord) socialLinks.push(`<a class="social-link" title="Discord">${data.discord}</a>`);
  if (data.website) socialLinks.push(`<a class="social-link" title="Website">${data.website}</a>`);

  const tagsHtml = data.tags?.length
    ? `<div class="nfd-tags">${data.tags.map((t) => `<span class="nfd-tag">${t}</span>`).join("")}</div>`
    : "";

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

      <div class="nfd-balance-section">
        <div class="nfd-balance-label">Balance</div>
        <div class="nfd-balance-value">
          <span class="nfd-balance-amount">${algoBalance}</span>
          <span class="nfd-balance-unit">ALGO</span>
        </div>
      </div>

      <div class="nfd-details">
        <div class="nfd-detail-row">
          <span class="nfd-detail-label">Address</span>
          <span class="nfd-detail-value nfd-address" title="${data.address}">${truncateAddress(data.address)}</span>
        </div>
        ${data.owner && data.owner !== data.address ? `
        <div class="nfd-detail-row">
          <span class="nfd-detail-label">Owner</span>
          <span class="nfd-detail-value nfd-address" title="${data.owner}">${truncateAddress(data.owner)}</span>
        </div>` : ""}
        <div class="nfd-detail-row">
          <span class="nfd-detail-label">Assets</span>
          <span class="nfd-detail-value">${assetCount} asset${assetCount !== 1 ? "s" : ""} opted in</span>
        </div>
      </div>

      ${socialLinks.length ? `<div class="nfd-socials">${socialLinks.join("")}</div>` : ""}

      ${data.showAssets && assetCount > 0 ? `
      <div class="nfd-assets-section">
        <div class="nfd-assets-header">
          <span class="nfd-assets-title">Assets (${assetCount})</span>
        </div>
        <div class="nfd-assets-list">
          ${data.assets
            .filter((a) => a.amount > 0)
            .slice(0, 20)
            .map((a) => `
              <div class="nfd-asset-row">
                <span class="nfd-asset-id">ASA ${a.assetId}</span>
                <span class="nfd-asset-amount">${formatAssetAmount(a.amount, a.assetId)}</span>
              </div>
            `).join("")}
          ${assetCount > 20 ? `<div class="nfd-assets-more">+ ${assetCount - 20} more assets</div>` : ""}
        </div>
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
    root.innerHTML = renderNfdCard(sc.nfdAccount);
    // Attach copy handler
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
