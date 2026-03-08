import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./swap-quote-card.css";

interface SwapQuoteData {
  expectedOutput: string;
  inputAmount: string;
  fromASAID: number;
  toASAID: number;
  type: string;
  usdIn: number;
  usdOut: number;
  userPriceImpact: number;
  marketPriceImpact: number;
  route: any;
  flattenedRoute: any[];
  requiredAppOptIns: any[];
  protocolFees: any;
  createdAt: string;
  address?: string;
}

interface SwapQuoteStructuredContent {
  swapQuote: SwapQuoteData;
}

const KNOWN_ASSETS: Record<number, { name: string; decimals: number }> = {
  0: { name: "ALGO", decimals: 6 },
  31566704: { name: "USDC", decimals: 6 },
  312769: { name: "USDt", decimals: 6 },
  386192725: { name: "goBTC", decimals: 8 },
  386195940: { name: "goETH", decimals: 8 },
};

function getAssetName(asaId: number): string {
  return KNOWN_ASSETS[asaId]?.name || `ASA #${asaId}`;
}

function formatAmount(raw: string, asaId: number): string {
  const known = KNOWN_ASSETS[asaId];
  if (!known) {
    try { return BigInt(Math.round(Number(raw))).toLocaleString(); } catch { return String(raw ?? "0"); }
  }
  const divisor = 10 ** known.decimals;
  const num = Number(raw) / divisor;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: known.decimals,
  });
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getPriceImpactClass(impact: number): string {
  if (impact == null || Number.isNaN(Number(impact))) return "impact-low";
  const abs = Math.abs(impact);
  if (abs < 1) return "impact-low";
  if (abs <= 3) return "impact-medium";
  return "impact-high";
}

function formatPriceImpact(impact: number): string {
  if (impact == null || Number.isNaN(Number(impact))) return "N/A";
  return `${impact >= 0 ? "+" : ""}${impact.toFixed(3)}%`;
}

function extractRouteSteps(flattenedRoute: any[]): string[] {
  if (!Array.isArray(flattenedRoute) || flattenedRoute.length === 0) return [];
  const protocols: string[] = [];
  for (const step of flattenedRoute) {
    const name = step.protocolName || step.protocol || step.name || "Unknown DEX";
    if (!protocols.includes(name)) {
      protocols.push(name);
    }
  }
  return protocols;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function renderSwapQuoteCard(data: SwapQuoteData): string {
  const fromName = getAssetName(data.fromASAID);
  const toName = getAssetName(data.toASAID);
  const formattedInput = formatAmount(data.inputAmount, data.fromASAID);
  const formattedOutput = formatAmount(data.expectedOutput, data.toASAID);
  const routeSteps = extractRouteSteps(data.flattenedRoute);
  const impactClass = getPriceImpactClass(data.userPriceImpact);
  const quoteType = data.type === "fixed-input" ? "Fixed Input" : "Fixed Output";

  const routeHtml = routeSteps.length > 0
    ? `<div class="swap-route">
        <div class="swap-section-label">Route</div>
        <div class="swap-route-path">
          <span class="swap-route-asset">${fromName}</span>
          ${routeSteps.map((p) => `<span class="swap-route-arrow">&#8594;</span><span class="swap-route-protocol">${p}</span>`).join("")}
          <span class="swap-route-arrow">&#8594;</span>
          <span class="swap-route-asset">${toName}</span>
        </div>
      </div>`
    : "";

  const feesHtml = data.protocolFees && typeof data.protocolFees === "object"
    ? `<div class="swap-detail-row swap-detail-row-fees">
        <span class="swap-detail-label">Protocol Fees</span>
        <div class="swap-fee-badges">
          ${Object.entries(data.protocolFees as Record<string, unknown>).map(([dex, fee], i) =>
            `<span class="swap-fee-badge swap-fee-badge-${i % 6}">${dex}: ${fee}</span>`
          ).join("")}
        </div>
      </div>`
    : "";

  const addressHtml = data.address
    ? `<div class="swap-detail-row">
        <span class="swap-detail-label">Address</span>
        <span class="swap-detail-value swap-mono" title="${data.address}">${truncateAddress(data.address)}</span>
      </div>`
    : "";

  const optInsHtml = data.requiredAppOptIns && data.requiredAppOptIns.length > 0
    ? `<div class="swap-detail-row">
        <span class="swap-detail-label">Required Opt-Ins</span>
        <span class="swap-detail-value">${data.requiredAppOptIns.length} app(s)</span>
      </div>`
    : "";

  return `
    <div class="swap-card">
      <div class="swap-header">
        <div class="swap-title">Swap Quote</div>
        <span class="swap-badge swap-badge-type">${quoteType}</span>
      </div>

      <div class="swap-amounts">
        <div class="swap-side swap-from">
          <div class="swap-side-label">From</div>
          <div class="swap-side-amount">${formattedInput}</div>
          <div class="swap-side-asset">${fromName}</div>
          <div class="swap-side-usd">${formatUsd(data.usdIn)}</div>
        </div>

        <div class="swap-arrow-divider">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>

        <div class="swap-side swap-to">
          <div class="swap-side-label">To</div>
          <div class="swap-side-amount">${formattedOutput}</div>
          <div class="swap-side-asset">${toName}</div>
          <div class="swap-side-usd">${formatUsd(data.usdOut)}</div>
        </div>
      </div>

      <div class="swap-details">
        <div class="swap-detail-row">
          <span class="swap-detail-label">Price Impact</span>
          <span class="swap-detail-value ${impactClass}">${formatPriceImpact(data.userPriceImpact)}</span>
        </div>
        <div class="swap-detail-row">
          <span class="swap-detail-label">Market Impact</span>
          <span class="swap-detail-value ${getPriceImpactClass(data.marketPriceImpact)}">${formatPriceImpact(data.marketPriceImpact)}</span>
        </div>
        ${feesHtml}
        ${addressHtml}
        ${optInsHtml}
      </div>

      ${routeHtml}
    </div>
  `;
}

function renderLoading(fromId?: number, toId?: number): string {
  const fromName = fromId !== undefined ? getAssetName(fromId) : "";
  const toName = toId !== undefined ? getAssetName(toId) : "";
  const label = fromName && toName
    ? `Getting ${fromName} to ${toName} quote...`
    : "Getting swap quote...";
  return `
    <div class="swap-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">${label}</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="swap-card error">
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

const app = new App({ name: "swap-quote-card-widget", version: "1.0.0" });

app.ontoolinput = (params) => {
  const args = params.arguments as { fromASAID?: number; toASAID?: number } | undefined;
  root.innerHTML = renderLoading(args?.fromASAID, args?.toASAID);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { fromASAID?: number; toASAID?: number } | undefined;
  if (args?.fromASAID !== undefined || args?.toASAID !== undefined) {
    root.innerHTML = renderLoading(args?.fromASAID, args?.toASAID);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as SwapQuoteStructuredContent | undefined;
  if (sc?.swapQuote) {
    try {
      root.innerHTML = renderSwapQuoteCard(sc.swapQuote);
    } catch (e) {
      console.error("Render error:", e);
      root.innerHTML = renderError("Failed to display swap quote.");
    }
  } else {
    root.innerHTML = renderError("No swap quote data returned.");
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
