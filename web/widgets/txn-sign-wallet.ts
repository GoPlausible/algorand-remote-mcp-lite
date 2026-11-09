import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./txn-sign-wallet.css";

const WALLET_SVG = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`;

const CHECK_SVG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

interface SignResult {
  txID?: string;
  signedCount: number;
  signerType: "wallet";
}

interface SignResultContent {
  signResult: SignResult;
}

function truncate(s: string): string {
  return s.length <= 20 ? s : `${s.slice(0, 8)}...${s.slice(-8)}`;
}

function renderLoading(): string {
  return `
    <div class="ts-card loading">
      <div class="ts-icon-ring ts-spin">
        <div class="ts-icon-inner">${WALLET_SVG}</div>
      </div>
      <div class="ts-title">Signing</div>
      <div class="ts-subtitle">Requesting vault signature<span class="ts-dots"><span>.</span><span>.</span><span>.</span></span></div>
    </div>`;
}

function renderSuccess(data: SignResult): string {
  const label = data.signedCount === 1 ? "1 transaction signed" : `${data.signedCount} transactions signed`;
  const txRow = data.txID
    ? `<div class="ts-detail-row"><span class="ts-detail-label">Tx ID</span><span class="ts-detail-value ts-mono">${truncate(data.txID)}</span></div>`
    : "";
  return `
    <div class="ts-card success">
      <div class="ts-check-ring">
        <div class="ts-check-inner">${CHECK_SVG}</div>
      </div>
      <div class="ts-title ts-green">Signed</div>
      <div class="ts-subtitle">${label} · Vault Wallet</div>
      ${txRow ? `<div class="ts-details">${txRow}</div>` : ""}
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="ts-card error">
      <div class="ts-error-icon">!</div>
      <div class="ts-title ts-red">Failed</div>
      <div class="ts-subtitle">${message}</div>
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

const app = new App({ name: "txn-sign-wallet-widget", version: "1.0.0" });

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as SignResultContent | undefined;
  if (sc?.signResult) {
    root.innerHTML = renderSuccess(sc.signResult);
  } else {
    root.innerHTML = renderError("No signing result returned.");
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
