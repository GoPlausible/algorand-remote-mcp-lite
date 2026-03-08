import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./raw-txn-submit.css";

interface RawSubmitResult {
  txId: string;
}

interface RawSubmitContent {
  rawSubmitResult: RawSubmitResult;
}

const CHECK_SVG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncate(s: string): string {
  return s.length <= 20 ? s : `${s.slice(0, 10)}...${s.slice(-8)}`;
}

function renderResult(data: RawSubmitResult): string {
  return `
    <div class="rts-card">
      <div class="rts-check-ring">
        <div class="rts-check-inner">${CHECK_SVG}</div>
      </div>
      <div class="rts-title rts-green">Submitted</div>
      <div class="rts-subtitle">Raw transaction sent directly to Algorand algod</div>
      <div class="rts-details">
        <div class="rts-detail-row">
          <span class="rts-detail-label">Tx ID</span>
          <span class="rts-detail-value rts-mono">${truncate(data.txId)}</span>
          <button class="rts-copy-btn" id="rts-copy" title="Copy Tx ID">${COPY_SVG}</button>
        </div>
      </div>
      <div class="rts-note">
        Submitted via algod API directly — no SDK transaction building involved. Confirmation is pending network inclusion.
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="rts-card">
      <div class="rts-chain-animation">
        <div class="rts-block rts-block-1"></div>
        <div class="rts-chain-link rts-link-1"></div>
        <div class="rts-block rts-block-2"></div>
        <div class="rts-chain-link rts-link-2"></div>
        <div class="rts-block rts-block-3"></div>
      </div>
      <div class="rts-title">Sending</div>
      <div class="rts-subtitle">Broadcasting raw transaction to Algorand<span class="rts-dots"><span>.</span><span>.</span><span>.</span></span></div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="rts-card">
      <div class="rts-error-icon">!</div>
      <div class="rts-title rts-red">Failed</div>
      <div class="rts-subtitle">${message}</div>
    </div>`;
}

function attachHandlers(data: RawSubmitResult) {
  const copyBtn = root.querySelector<HTMLButtonElement>("#rts-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(data.txId).then(() => {
        copyBtn.innerHTML = CHECK_COPY_SVG;
        copyBtn.classList.add("rts-copied");
        setTimeout(() => {
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.classList.remove("rts-copied");
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

const app = new App({ name: "raw-txn-submit-widget", version: "1.0.0" });

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as RawSubmitContent | undefined;
  if (sc?.rawSubmitResult) {
    root.innerHTML = renderResult(sc.rawSubmitResult);
    attachHandlers(sc.rawSubmitResult);
  } else {
    root.innerHTML = renderError("No submission result returned.");
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
