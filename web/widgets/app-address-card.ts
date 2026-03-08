import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./app-address-card.css";

interface AppAddressData {
  appId: number;
  address: string;
  explorerUrl?: string;
}

interface AppAddressStructuredContent {
  appAddress: AppAddressData;
}

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const LINK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const APP_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

function renderCard(data: AppAddressData): string {
  return `
    <div class="aac-card">
      <div class="aac-header">
        <div class="aac-icon">${APP_SVG}</div>
        <div class="aac-title-group">
          <div class="aac-title">Application Address</div>
          <div class="aac-app-id-badge">App ID #${data.appId.toLocaleString()}</div>
        </div>
      </div>

      <div class="aac-address-section">
        <div class="aac-address-label">Derived Address</div>
        <div class="aac-address-row">
          <span class="aac-address-value aac-mono" title="${data.address}">${truncateAddr(data.address)}</span>
          <button class="aac-copy-btn" id="aac-copy" title="Copy address">${COPY_SVG}</button>
        </div>
      </div>

      <div class="aac-info">
        This address is deterministically derived from App ID #${data.appId.toLocaleString()} and cannot hold ALGO unless funded.
      </div>

      ${data.explorerUrl ? `
      <button class="aac-explorer-btn" data-url="${data.explorerUrl}">
        View on Allo ${LINK_SVG}
      </button>` : ""}
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="aac-card aac-loading">
      <div class="aac-loading-pulse"></div>
      <div class="aac-loading-text">Resolving app address...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="aac-card aac-error">
      <div class="aac-error-icon">!</div>
      <div class="aac-error-text">${message}</div>
    </div>`;
}

function attachHandlers(data: AppAddressData) {
  const copyBtn = root.querySelector<HTMLButtonElement>("#aac-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(data.address).then(() => {
        copyBtn.innerHTML = CHECK_COPY_SVG;
        copyBtn.classList.add("aac-copied");
        setTimeout(() => {
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.classList.remove("aac-copied");
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

const app = new App({ name: "app-address-card-widget", version: "1.0.0" });

document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-url]");
  if (btn) {
    const url = btn.dataset.url;
    if (url) app.openLink({ url });
  }
});

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AppAddressStructuredContent | undefined;
  if (sc?.appAddress) {
    root.innerHTML = renderCard(sc.appAddress);
    attachHandlers(sc.appAddress);
  } else {
    root.innerHTML = renderError("No app address data returned.");
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
