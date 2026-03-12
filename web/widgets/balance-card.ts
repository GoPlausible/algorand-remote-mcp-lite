import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./balance-card.css";

interface BalanceData {
  address: string;
  balance: number;
  microAlgos: number;
  minBalance: number;
}

interface BalanceStructuredContent {
  balanceData: BalanceData;
}

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const WALLET_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="16" rx="2" ry="2"/><path d="M1 10h22"/><path d="M16 15h2"/></svg>`;

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function formatAlgo(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatMicroAlgo(value: number): string {
  return value.toLocaleString();
}

function renderCard(data: BalanceData): string {
  const mbrAlgo = data.minBalance / 1_000_000;
  const availableAlgo = Math.max(0, data.balance - mbrAlgo);

  return `
    <div class="bal-card">
      <div class="bal-header">
        <div class="bal-icon">${WALLET_SVG}</div>
        <div class="bal-address-section">
          <div class="bal-label">Account</div>
          <div class="bal-address-row">
            <span class="bal-address" title="${data.address}">${truncateAddress(data.address)}</span>
            <button class="bal-copy-inline" data-copy="${data.address}" title="Copy Address">${COPY_SVG}</button>
          </div>
        </div>
      </div>

      <div class="bal-balance-section">
        <div class="bal-balance-label">Balance</div>
        <div class="bal-balance-value">${formatAlgo(data.balance)}<span class="bal-balance-unit">ALGO</span></div>
      </div>

      <div class="bal-details">
        <div class="bal-detail-row">
          <span class="bal-detail-label">Available</span>
          <span class="bal-detail-value">${formatAlgo(availableAlgo)} ALGO</span>
        </div>
        <div class="bal-detail-row">
          <span class="bal-detail-label">Min Balance (MBR)</span>
          <span class="bal-detail-value">${formatAlgo(mbrAlgo)} ALGO</span>
        </div>
        <div class="bal-detail-row">
          <span class="bal-detail-label">MicroAlgos</span>
          <span class="bal-detail-value">${formatMicroAlgo(data.microAlgos)}</span>
        </div>
      </div>
    </div>`;
}

function renderLoading(address?: string): string {
  return `
    <div class="bal-card bal-loading">
      <div class="bal-loading-pulse"></div>
      <div class="bal-loading-text">Checking balance${address ? ` for ${truncateAddress(address)}` : ""}...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="bal-card bal-error">
      <div class="bal-error-icon">!</div>
      <div class="bal-error-text">${message}</div>
    </div>`;
}

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

const app = new App({ name: "balance-card-widget", version: "1.0.0" });

document.addEventListener("click", (e) => {
  const copyBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-copy]");
  if (copyBtn) {
    e.stopPropagation();
    const text = copyBtn.dataset.copy || "";
    navigator.clipboard.writeText(text).then(() => {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = CHECK_SVG;
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    });
  }
});

app.ontoolinput = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  root.innerHTML = renderLoading(args?.address);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  if (args?.address) root.innerHTML = renderLoading(args.address);
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as BalanceStructuredContent | undefined;
  if (sc?.balanceData) {
    root.innerHTML = renderCard(sc.balanceData);
  } else {
    root.innerHTML = renderError("No balance data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => {
  console.error("App error:", err);
  root.innerHTML = renderError("An error occurred.");
};

app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
