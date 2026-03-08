import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./address-validate-card.css";

interface ValidationResult {
  address: string;
  isValid: boolean;
}

interface ValidateStructuredContent {
  validationResult: ValidationResult;
}

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const CHECK_BIG_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const X_BIG_SVG = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

function renderCard(data: ValidationResult): string {
  const { address, isValid } = data;
  return `
    <div class="avc-card ${isValid ? "avc-valid" : "avc-invalid"}">
      <div class="avc-icon-ring ${isValid ? "avc-ring-green" : "avc-ring-red"}">
        <div class="avc-icon-inner ${isValid ? "avc-inner-green" : "avc-inner-red"}">
          ${isValid ? CHECK_BIG_SVG : X_BIG_SVG}
        </div>
      </div>
      <div class="avc-status ${isValid ? "avc-status-green" : "avc-status-red"}">
        ${isValid ? "Valid Address" : "Invalid Address"}
      </div>
      <div class="avc-subtitle">
        ${isValid ? "This is a well-formed Algorand address" : "This string is not a valid Algorand address"}
      </div>
      <div class="avc-address-box">
        <span class="avc-address-label">Address</span>
        <div class="avc-address-row">
          <span class="avc-address-value avc-mono" title="${address}">${truncateAddr(address)}</span>
          ${isValid ? `<button class="avc-copy-btn" id="avc-copy" title="Copy address">${COPY_SVG}</button>` : ""}
        </div>
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="avc-card avc-loading">
      <div class="avc-loading-pulse"></div>
      <div class="avc-loading-text">Validating address...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="avc-card avc-error">
      <div class="avc-error-icon">!</div>
      <div class="avc-error-text">${message}</div>
    </div>`;
}

function attachHandlers(data: ValidationResult) {
  if (!data.isValid) return;
  const copyBtn = root.querySelector<HTMLButtonElement>("#avc-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(data.address).then(() => {
        copyBtn.innerHTML = CHECK_COPY_SVG;
        copyBtn.classList.add("avc-copied");
        setTimeout(() => {
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.classList.remove("avc-copied");
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

const app = new App({ name: "address-validate-card-widget", version: "1.0.0" });

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as ValidateStructuredContent | undefined;
  if (sc?.validationResult) {
    root.innerHTML = renderCard(sc.validationResult);
    attachHandlers(sc.validationResult);
  } else {
    root.innerHTML = renderError("No validation result returned.");
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
