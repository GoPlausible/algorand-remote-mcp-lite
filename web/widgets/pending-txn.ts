import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./pending-txn.css";

const COPY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ALLO_SVG = `<svg width="14" height="14" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="currentColor"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="currentColor"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="currentColor"/></svg>`;
const ARROW_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

interface PendingTxnData {
  txid: string;
  status: 'pending' | 'confirmed' | 'error';
  poolError: string;
  confirmedRound?: number;
  type?: string;
  sender?: string;
  receiver?: string;
  amount?: number;
  fee?: number;
  firstValid?: number;
  lastValid?: number;
  assetId?: number;
  note?: string;
}

interface PendingTxnStructuredContent {
  pendingTxn?: PendingTxnData;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function truncateTxId(txid: string): string {
  if (txid.length <= 16) return txid;
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

function formatAlgo(microAlgos: number): string {
  return (microAlgos / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 6 });
}

function copyToClipboard(text: string, btn: HTMLElement) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = CHECK_SVG;
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  });
}

function typeLabel(type?: string): string {
  const map: Record<string, string> = {
    pay: 'Payment',
    axfer: 'Asset Transfer',
    acfg: 'Asset Config',
    afrz: 'Asset Freeze',
    appl: 'App Call',
    keyreg: 'Key Registration',
    stpf: 'State Proof',
  };
  return map[type ?? ''] ?? (type ? type.toUpperCase() : 'Unknown');
}

function renderCard(data: PendingTxnData): string {
  const isConfirmed = data.status === 'confirmed';
  const isError = data.status === 'error' || !!data.poolError;

  const headerClass = isError ? 'pt-header-error' : isConfirmed ? 'pt-header-confirmed' : 'pt-header-pending';
  const statusLabel = isError ? 'Pool Error' : isConfirmed ? 'Confirmed' : 'Pending';
  const statusClass = isError ? 'pt-badge-error' : isConfirmed ? 'pt-badge-confirmed' : 'pt-badge-pending';

  const amountSection = (data.amount !== undefined && data.type === 'pay')
    ? `<div class="pt-amount-section">
        <div class="pt-amount-label">Amount</div>
        <div class="pt-amount-value">${formatAlgo(data.amount)} ALGO</div>
       </div><hr class="pt-separator" />`
    : (data.amount !== undefined && data.type === 'axfer')
    ? `<div class="pt-amount-section">
        <div class="pt-amount-label">Asset Amount</div>
        <div class="pt-amount-value">${BigInt(data.amount).toLocaleString()}</div>
        ${data.assetId ? `<div class="pt-amount-sub">Asset #${data.assetId}</div>` : ''}
       </div><hr class="pt-separator" />`
    : '';

  const senderRow = data.sender
    ? `<div class="pt-address-row">
        <span class="pt-addr-label">From</span>
        <span class="pt-addr-val"><span class="pt-mono" title="${data.sender}">${truncateAddress(data.sender)}</span>
          <button class="pt-copy-btn" data-copy="${data.sender}" title="Copy">${COPY_SVG}</button></span>
       </div>`
    : '';

  const arrowRow = (data.sender && data.receiver)
    ? `<div class="pt-arrow-row">${ARROW_SVG}</div>`
    : '';

  const receiverRow = data.receiver
    ? `<div class="pt-address-row">
        <span class="pt-addr-label">To</span>
        <span class="pt-addr-val"><span class="pt-mono" title="${data.receiver}">${truncateAddress(data.receiver)}</span>
          <button class="pt-copy-btn" data-copy="${data.receiver}" title="Copy">${COPY_SVG}</button></span>
       </div>`
    : '';

  const txidRow = data.txid
    ? `<div class="pt-detail-row">
        <span class="pt-detail-label">Tx ID</span>
        <span class="pt-detail-value pt-mono" title="${data.txid}">${truncateTxId(data.txid)}</span>
        <button class="pt-copy-btn" data-copy="${data.txid}" title="Copy Tx ID">${COPY_SVG}</button>
       </div>`
    : '';

  const roundRow = (data.firstValid !== undefined && data.lastValid !== undefined)
    ? `<div class="pt-detail-row">
        <span class="pt-detail-label">Valid Rounds</span>
        <span class="pt-detail-value pt-mono">${data.firstValid.toLocaleString()} – ${data.lastValid.toLocaleString()}</span>
       </div>`
    : '';

  const confirmedRoundRow = isConfirmed && data.confirmedRound
    ? `<div class="pt-detail-row">
        <span class="pt-detail-label">Confirmed Round</span>
        <span class="pt-detail-value pt-mono">${data.confirmedRound.toLocaleString()}</span>
       </div>`
    : '';

  const feeRow = data.fee !== undefined
    ? `<div class="pt-detail-row">
        <span class="pt-detail-label">Fee</span>
        <span class="pt-detail-value pt-mono">${formatAlgo(data.fee)} ALGO</span>
       </div>`
    : '';

  const noteRow = data.note
    ? `<div class="pt-detail-row">
        <span class="pt-detail-label">Note</span>
        <span class="pt-detail-value pt-note">${data.note}</span>
       </div>`
    : '';

  const poolErrorSection = data.poolError
    ? `<div class="pt-pool-error"><span class="pt-pool-error-label">Pool Error:</span> ${data.poolError}</div>`
    : '';

  const explorerBtn = data.txid
    ? `<button class="pt-explorer-btn" data-url="https://allo.info/tx/${data.txid}">${ALLO_SVG} View on allo.info</button>`
    : '';

  return `
    <div class="pt-card">
      <div class="pt-header ${headerClass}">
        <div class="pt-header-top">
          <span class="pt-title">Pending Transaction</span>
          <span class="pt-badge ${statusClass}">${statusLabel}</span>
        </div>
        ${data.type ? `<span class="pt-type-pill">${typeLabel(data.type)}</span>` : ''}
      </div>

      <div class="pt-body">
        ${amountSection}
        ${senderRow}
        ${arrowRow}
        ${receiverRow}
        ${(senderRow || receiverRow) ? '<hr class="pt-separator" />' : ''}
        <div class="pt-details">
          ${txidRow}
          ${roundRow}
          ${confirmedRoundRow}
          ${feeRow}
          ${noteRow}
        </div>
        ${poolErrorSection}
        ${explorerBtn}
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="pt-card pt-loading">
      <div class="pt-loading-pulse"></div>
      <div class="pt-loading-text">Loading transaction...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="pt-card pt-error-state">
      <div class="pt-error-icon">!</div>
      <div class="pt-error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers() {
  root.querySelectorAll<HTMLElement>(".pt-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.copy;
      if (val) copyToClipboard(val, btn);
    });
  });
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

const app = new App({ name: "pending-txn-widget", version: "1.0.0" });

document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".pt-explorer-btn");
  if (btn?.dataset.url) app.openLink({ url: btn.dataset.url });
});

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as PendingTxnStructuredContent | undefined;
  if (sc?.pendingTxn) {
    root.innerHTML = renderCard(sc.pendingTxn);
    attachEventHandlers();
    return;
  }
  root.innerHTML = renderError("No transaction data returned.");
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
