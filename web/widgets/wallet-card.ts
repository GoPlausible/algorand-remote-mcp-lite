import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./wallet-card.css";

interface WalletAccount {
  address: string;
  amount: number;
  assets: Array<{ assetId: number; amount: number }>;
  user: string;
  provider: string;
  publickey: string;
}

interface WalletStructuredContent {
  accounts: WalletAccount[];
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

function renderWalletCard(account: WalletAccount): string {
  const algoBalance = formatAlgo(account.amount);
  const assetCount = account.assets?.length || 0;

  return `
    <div class="wallet-card">
      <div class="wallet-header">
        <div class="wallet-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
          </svg>
        </div>
        <div class="wallet-title-group">
          <h2 class="wallet-title">Algorand Wallet</h2>
          <span class="wallet-network">Mainnet</span>
        </div>
        <div class="wallet-provider">${account.provider}</div>
      </div>

      <div class="wallet-balance-section">
        <div class="balance-label">Balance</div>
        <div class="balance-value">
          <span class="balance-amount">${algoBalance}</span>
          <span class="balance-unit">ALGO</span>
        </div>
      </div>

      <div class="wallet-details">
        <div class="detail-row">
          <span class="detail-label">Address</span>
          <span class="detail-value address-value" title="${account.address}">${truncateAddress(account.address)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">User</span>
          <span class="detail-value">${account.user}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Assets</span>
          <span class="detail-value">${assetCount} asset${assetCount !== 1 ? "s" : ""} opted in</span>
        </div>
      </div>

      <button class="copy-btn" data-address="${account.address}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        Copy Address
      </button>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="wallet-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">Loading wallet info...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="wallet-card error">
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

const app = new App({ name: "wallet-card-widget", version: "1.0.0" });

app.ontoolinput = (params) => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as WalletStructuredContent | undefined;
  if (sc?.accounts?.length) {
    root.innerHTML = renderWalletCard(sc.accounts[0]);
    // Attach copy handler
    const copyBtn = root.querySelector(".copy-btn") as HTMLButtonElement | null;
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
    root.innerHTML = renderError("No wallet data returned.");
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
