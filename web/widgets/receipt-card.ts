import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./receipt-card.css";

interface ReceiptData {
  sender: string;
  receiver: string;
  amount?: number;
  assetId?: number;
  txId: string;
  note?: string;
  receiptLink: string;
  createdAt: string;
}

interface ReceiptStructuredContent {
  receipt: ReceiptData;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function formatAmount(amount: number, assetId?: number): string {
  if (assetId === undefined || assetId === 0) {
    // ALGO amount in microAlgos
    return (amount / 1_000_000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }
  return amount.toLocaleString();
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function copyIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function checkIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function arrowDownIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
}

function renderReceiptCard(data: ReceiptData): string {
  const timestamp = formatTimestamp(data.createdAt);
  const assetLabel =
    data.assetId !== undefined && data.assetId !== 0
      ? `ASA #${data.assetId}`
      : "ALGO";

  const amountHtml =
    data.amount !== undefined
      ? `
    <div class="rc-amount-section">
      <div class="rc-amount-label">Amount</div>
      <div class="rc-amount-value">${formatAmount(data.amount, data.assetId)}</div>
      <div class="rc-amount-asset">${assetLabel}</div>
    </div>`
      : "";

  const noteHtml = data.note
    ? `
    <div class="rc-detail-row">
      <span class="rc-detail-label">Note</span>
      <span class="rc-note-value">${data.note}</span>
    </div>`
    : "";

  return `
    <div class="rc-card">
      <div class="rc-header">
        <div class="rc-header-title">Transaction Receipt</div>
        <div class="rc-header-timestamp">${timestamp}</div>
      </div>

      <div class="rc-body">
        <hr class="rc-separator" />

        <div class="rc-address-section">
          <div class="rc-address-row">
            <span class="rc-address-label">From</span>
            <span class="rc-address-value" title="${data.sender}">${truncateAddress(data.sender)}</span>
            <button class="rc-copy-inline" data-copy="${data.sender}" title="Copy sender address">${copyIcon()}</button>
          </div>

          <div class="rc-arrow">${arrowDownIcon()}</div>

          <div class="rc-address-row">
            <span class="rc-address-label">To</span>
            <span class="rc-address-value" title="${data.receiver}">${truncateAddress(data.receiver)}</span>
            <button class="rc-copy-inline" data-copy="${data.receiver}" title="Copy receiver address">${copyIcon()}</button>
          </div>
        </div>

        ${amountHtml}

        <hr class="rc-separator" />

        <div class="rc-detail-row">
          <span class="rc-detail-label">Tx ID</span>
          <span class="rc-detail-value rc-mono" title="${data.txId}">${truncateAddress(data.txId)}</span>
          <button class="rc-copy-inline" data-copy="${data.txId}" title="Copy transaction ID">${copyIcon()}</button>
        </div>

        ${noteHtml}

        <hr class="rc-separator" />

        <a class="rc-view-btn" href="${data.receiptLink}" target="_blank" rel="noopener noreferrer">View Full Receipt</a>
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="rc-card loading">
      <div class="rc-loading-pulse"></div>
      <div class="rc-loading-text">Loading transaction receipt...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="rc-card error">
      <div class="rc-error-icon">!</div>
      <div class="rc-error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".rc-copy-inline");
  copyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.dataset.copy || "";
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = checkIcon();
        btn.classList.add("copied");
        setTimeout(() => {
          btn.innerHTML = copyIcon();
          btn.classList.remove("copied");
        }, 2000);
      });
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

const app = new App({ name: "receipt-card-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as ReceiptStructuredContent | undefined;
  if (sc?.receipt) {
    root.innerHTML = renderReceiptCard(sc.receipt);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No receipt data returned.");
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
