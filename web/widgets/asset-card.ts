import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./asset-card.css";

interface AssetDetailsData {
  asset_id: number;
  name?: string | null;
  unit_name?: string | null;
  fraction_decimals: number;
  total_supply: number;
  total_supply_as_str: string;
  creator_address: string;
  verification_tier: "verified" | "unverified" | "suspicious";
  is_collectible: boolean;
  circulating_supply: string;
  url?: string | null;
  logo?: string | null;
  usd_value?: string | null;
  usd_value_24_hour_ago?: string | null;
  description?: string | null;
}

interface AssetStructuredContent {
  assetDetails: AssetDetailsData;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function formatSupply(value: string, decimals: number): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (decimals > 0) {
    const adjusted = num / 10 ** decimals;
    return adjusted.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(decimals, 6),
    });
  }
  return num.toLocaleString();
}

function formatUsd(value: string | null | undefined): string {
  if (!value) return "--";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (num < 0.01 && num > 0) {
    return `$${num.toFixed(8)}`;
  }
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

function calcPriceChange(current: string | null | undefined, previous: string | null | undefined): { percent: string; direction: "up" | "down" | "flat" } | null {
  if (!current || !previous) return null;
  const cur = parseFloat(current);
  const prev = parseFloat(previous);
  if (isNaN(cur) || isNaN(prev) || prev === 0) return null;
  const change = ((cur - prev) / prev) * 100;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return {
    percent: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
    direction,
  };
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case "verified": return "asset-badge-verified";
    case "suspicious": return "asset-badge-suspicious";
    default: return "asset-badge-unverified";
  }
}

function renderAssetCard(data: AssetDetailsData): string {
  const displayName = data.name || `Asset #${data.asset_id}`;
  const unitName = data.unit_name || "";
  const tierLabel = data.verification_tier.toUpperCase();

  const logoHtml = data.logo
    ? `<img class="asset-logo-img" src="${data.logo}" alt="${displayName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="asset-logo-fallback" style="display:none">${displayName.charAt(0).toUpperCase()}</div>`
    : `<div class="asset-logo-fallback">${displayName.charAt(0).toUpperCase()}</div>`;

  const priceChange = calcPriceChange(data.usd_value, data.usd_value_24_hour_ago);
  const changeHtml = priceChange
    ? `<span class="asset-price-change ${priceChange.direction}">
        <svg class="asset-change-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          ${priceChange.direction === "up" ? '<polyline points="18 15 12 9 6 15"/>' : priceChange.direction === "down" ? '<polyline points="6 9 12 15 18 9"/>' : '<line x1="5" y1="12" x2="19" y2="12"/>'}
        </svg>
        ${priceChange.percent}
      </span>`
    : "";

  const formattedTotalSupply = formatSupply(data.total_supply_as_str || String(data.total_supply), data.fraction_decimals);
  const formattedCirculating = formatSupply(data.circulating_supply, data.fraction_decimals);

  return `
    <div class="asset-card">
      <div class="asset-hero">
        <div class="asset-logo">${logoHtml}</div>
        <div class="asset-identity">
          <h2 class="asset-name">${displayName}</h2>
          ${unitName ? `<span class="asset-unit">${unitName}</span>` : ""}
          <div class="asset-badges">
            <span class="asset-badge ${tierBadgeClass(data.verification_tier)}">${tierLabel}</span>
            ${data.is_collectible ? '<span class="asset-badge asset-badge-collectible">COLLECTIBLE</span>' : ""}
          </div>
        </div>
      </div>

      ${data.description ? `<p class="asset-description">${data.description}</p>` : ""}

      ${data.usd_value ? `
      <div class="asset-price-section">
        <div class="asset-price-label">Current Price</div>
        <div class="asset-price-row">
          <span class="asset-price-value">${formatUsd(data.usd_value)}</span>
          ${changeHtml}
        </div>
        ${priceChange ? `<div class="asset-price-sub">24h change</div>` : ""}
      </div>` : ""}

      <div class="asset-details">
        <div class="asset-detail-row">
          <span class="asset-detail-label">Asset ID</span>
          <span class="asset-detail-value asset-mono">${data.asset_id}</span>
        </div>
        <div class="asset-detail-row">
          <span class="asset-detail-label">Total Supply</span>
          <span class="asset-detail-value">${formattedTotalSupply}${unitName ? ` ${unitName}` : ""}</span>
        </div>
        <div class="asset-detail-row">
          <span class="asset-detail-label">Circulating Supply</span>
          <span class="asset-detail-value">${formattedCirculating}${unitName ? ` ${unitName}` : ""}</span>
        </div>
        <div class="asset-detail-row">
          <span class="asset-detail-label">Decimals</span>
          <span class="asset-detail-value">${data.fraction_decimals}</span>
        </div>
        <div class="asset-detail-row">
          <span class="asset-detail-label">Creator</span>
          <span class="asset-detail-value asset-address" title="${data.creator_address}">${truncateAddress(data.creator_address)}</span>
        </div>
        ${data.url ? `
        <div class="asset-detail-row">
          <span class="asset-detail-label">URL</span>
          <span class="asset-detail-value asset-url" title="${data.url}">${data.url.length > 32 ? data.url.slice(0, 32) + "..." : data.url}</span>
        </div>` : ""}
      </div>

      <button class="asset-copy-btn" data-address="${data.creator_address}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        Copy Creator Address
      </button>
    </div>
  `;
}

function renderLoading(name?: string): string {
  return `
    <div class="asset-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">Looking up ${name || "asset"}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="asset-card error">
      <div class="error-icon">!</div>
      <div class="error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers(data: AssetDetailsData) {
  const copyBtn = root.querySelector(".asset-copy-btn") as HTMLButtonElement | null;
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
            Copy Creator Address
          `;
        }, 2000);
      });
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

const app = new App({ name: "asset-card-widget", version: "1.0.0" });

app.ontoolinput = (params) => {
  const args = params.arguments as { asset_id?: number; name?: string } | undefined;
  root.innerHTML = renderLoading(args?.name || (args?.asset_id ? `Asset #${args.asset_id}` : undefined));
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { asset_id?: number; name?: string } | undefined;
  if (args?.name || args?.asset_id) {
    root.innerHTML = renderLoading(args.name || `Asset #${args.asset_id}`);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AssetStructuredContent | undefined;
  if (sc?.assetDetails) {
    root.innerHTML = renderAssetCard(sc.assetDetails);
    attachEventHandlers(sc.assetDetails);
  } else {
    root.innerHTML = renderError("Asset not found or no data returned.");
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
