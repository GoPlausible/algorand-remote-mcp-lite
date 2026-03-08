import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./wallet-reset-card.css";

interface ResetResult {
  address: string;
  user: string;
  provider: string;
}

interface ResetStructuredContent {
  resetResult: ResetResult;
}

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const REFRESH_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

function renderCard(data: ResetResult): string {
  return `
    <div class="wrc-card">
      <div class="wrc-header">
        <div class="wrc-icon">${REFRESH_SVG}</div>
        <div>
          <div class="wrc-title">Account Reset</div>
          <div class="wrc-subtitle">New keypair generated</div>
        </div>
      </div>

      <div class="wrc-warning">
        ⚠️ Your previous wallet address is no longer active. Update any funded accounts or smart contract references to use the new address.
      </div>

      <div class="wrc-address-section">
        <div class="wrc-address-label">New Address</div>
        <div class="wrc-address-row">
          <span class="wrc-address-value wrc-mono" title="${data.address}">${truncateAddr(data.address)}</span>
          <button class="wrc-copy-btn" id="wrc-copy" title="Copy address">${COPY_SVG}</button>
        </div>
      </div>

      <div class="wrc-meta">
        <span class="wrc-meta-chip">${data.provider}</span>
        <span class="wrc-meta-chip">${data.user}</span>
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="wrc-card wrc-loading">
      <div class="wrc-loading-pulse"></div>
      <div class="wrc-loading-text">Resetting account...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="wrc-card wrc-error">
      <div class="wrc-error-icon">!</div>
      <div class="wrc-error-text">${message}</div>
    </div>`;
}

function attachHandlers(data: ResetResult) {
  const copyBtn = root.querySelector<HTMLButtonElement>("#wrc-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(data.address).then(() => {
        copyBtn.innerHTML = CHECK_COPY_SVG;
        copyBtn.classList.add("wrc-copied");
        setTimeout(() => {
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.classList.remove("wrc-copied");
        }, 2000);
      });
    });
  }
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

const app = new App({ name: "wallet-reset-card-widget", version: "1.0.0" });

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as ResetStructuredContent | undefined;
  if (sc?.resetResult) {
    root.innerHTML = renderCard(sc.resetResult);
    attachHandlers(sc.resetResult);
  } else {
    root.innerHTML = renderError("No reset result returned.");
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
