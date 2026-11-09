import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./txn-submit.css";

const CHECK_SVG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const LINK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

interface TxnReceipt {
  txID: string;
  confirmedRound: number;
  date: string;
  type: string;
  network: string;
  explorerUrl: string;
}

interface GroupReceipt {
  groupTxID: string;
  confirmedRound: number;
  date: string;
  txnCount: number;
  totalFees: number;
  network: string;
  explorerUrl: string;
}

interface SubmitContent {
  txnReceipt?: TxnReceipt;
  groupReceipt?: GroupReceipt;
}

function truncate(s: string): string {
  return s.length <= 20 ? s : `${s.slice(0, 10)}...${s.slice(-8)}`;
}

function renderLoading(): string {
  return `
    <div class="ts-card loading">
      <div class="ts-chain-animation">
        <div class="ts-block ts-block-1"></div>
        <div class="ts-chain-link ts-link-1"></div>
        <div class="ts-block ts-block-2"></div>
        <div class="ts-chain-link ts-link-2"></div>
        <div class="ts-block ts-block-3"></div>
      </div>
      <div class="ts-title">Sending</div>
      <div class="ts-subtitle">Broadcasting to Algorand<span class="ts-dots"><span>.</span><span>.</span><span>.</span></span></div>
    </div>`;
}

function renderReceipt(txID: string, confirmedRound: number, label: string, explorerUrl: string): string {
  return `
    <div class="ts-card success">
      <div class="ts-check-ring">
        <div class="ts-check-inner">${CHECK_SVG}</div>
      </div>
      <div class="ts-title ts-green">Confirmed</div>
      <div class="ts-subtitle">${label}</div>
      <div class="ts-details">
        <div class="ts-detail-row">
          <span class="ts-detail-label">Tx ID</span>
          <span class="ts-detail-value ts-mono">${truncate(txID)}</span>
        </div>
        <div class="ts-detail-row">
          <span class="ts-detail-label">Block</span>
          <span class="ts-detail-value">#${confirmedRound.toLocaleString()}</span>
        </div>
      </div>
      <button class="ts-explorer-btn" data-url="${explorerUrl}">
        View on Allo ${LINK_SVG}
      </button>
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

const app = new App({ name: "txn-submit-widget", version: "1.0.0" });

document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".ts-explorer-btn");
  if (btn) {
    const url = btn.dataset.url;
    if (url) app.openLink({ url });
  }
});

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as SubmitContent | undefined;
  if (sc?.txnReceipt) {
    const r = sc.txnReceipt;
    const label = `${r.type.toUpperCase()} · ${r.network}`;
    root.innerHTML = renderReceipt(r.txID, r.confirmedRound, label, r.explorerUrl);
  } else if (sc?.groupReceipt) {
    const r = sc.groupReceipt;
    const label = `${r.txnCount} txns · ${r.network}`;
    root.innerHTML = renderReceipt(r.groupTxID, r.confirmedRound, label, r.explorerUrl);
  } else {
    root.innerHTML = renderError("No confirmation data returned.");
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
