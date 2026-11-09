import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./txn-receipt.css";

interface TxnReceiptData {
  txID: string;
  confirmedRound: number;
  date: string;
  type: string;
  sender: string;
  receiver?: string;
  amount?: number;
  assetID?: number;
  fee: number;
  network: string;
  explorerUrl: string;
}

interface TxnReceiptStructuredContent {
  txnReceipt: TxnReceiptData;
}

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function copyIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function checkIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function checkCircleIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function arrowDownIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
}

function externalLinkIcon(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
}

function copyBtn(text: string, cls: string): string {
  return `<button class="${cls}" data-copy="${text}" title="Copy">${copyIcon()}</button>`;
}

function typePill(type: string): string {
  const cls = ["pay", "axfer", "acfg", "appl"].includes(type)
    ? `tr-type-${type}`
    : "tr-type-other";
  const labels: Record<string, string> = {
    pay: "Payment",
    axfer: "Asset Xfer",
    acfg: "Asset Cfg",
    appl: "App Call",
    afrz: "Freeze",
    keyreg: "Key Reg",
  };
  return `<span class="tr-type-pill ${cls}">${labels[type] ?? type.toUpperCase()}</span>`;
}

function formatAmount(amount: number, type: string, assetID?: number): string {
  if (type === "pay") {
    return `${(amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ALGO`;
  }
  if (type === "axfer") {
    if (assetID === 31566704) return `${(amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC`;
    if (assetID === 312769) return `${(amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDt`;
    return `${amount.toLocaleString()} · ASA #${assetID ?? "?"}`;
  }
  return String(amount);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function addrRow(label: string, addr: string): string {
  return `
    <div class="tr-address-row">
      <span class="tr-address-label">${label}</span>
      <span class="tr-address-value" title="${addr}">${truncateAddr(addr)}</span>
      ${copyBtn(addr, "tr-copy-inline")}
    </div>`;
}

function detailRow(label: string, value: string, mono = false, copyText?: string): string {
  const valueClass = `tr-detail-value${mono ? " tr-mono" : ""}`;
  const copy = copyText ? copyBtn(copyText, "tr-copy-inline") : "";
  return `
    <div class="tr-detail-row">
      <span class="tr-detail-label">${label}</span>
      <span class="${valueClass}" title="${copyText ?? value}">${value}</span>
      ${copy}
    </div>`;
}

function renderCard(data: TxnReceiptData): string {
  const feeAlgo = (data.fee / 1_000_000).toFixed(3);
  const txIDShort = truncateAddr(data.txID);
  const dateStr = formatDate(data.date);
  const networkLabel = data.network === "mainnet" ? "Mainnet" : data.network === "testnet" ? "Testnet" : data.network;

  let amountSection = "";
  if ((data.type === "pay" || data.type === "axfer") && data.amount !== undefined) {
    amountSection = `
      <div class="tr-amount-hero">
        <div class="tr-amount-label">Amount</div>
        <div class="tr-amount-value">${formatAmount(data.amount, data.type, data.assetID)}</div>
      </div>`;
  }

  let addressSection = "";
  if (data.sender) {
    addressSection += addrRow("From", data.sender);
    if (data.receiver && data.receiver !== data.sender) {
      addressSection += `<div class="tr-arrow-row">${arrowDownIcon()}</div>`;
      addressSection += addrRow("To", data.receiver);
    }
  }

  return `
    <div class="tr-card">
      <div class="tr-header">
        <div class="tr-header-top">
          <div class="tr-check">${checkCircleIcon()}</div>
          <div class="tr-header-title">Transaction Confirmed</div>
        </div>
        <div class="tr-header-subtitle">Round ${data.confirmedRound.toLocaleString()} · ${networkLabel}</div>
        <div class="tr-badge">✓ Confirmed · ${typePill(data.type)}</div>
      </div>

      <div class="tr-body">
        ${amountSection}
        ${amountSection ? '<hr class="tr-separator" />' : ""}

        ${addressSection ? `<div class="tr-address-section">${addressSection}</div><hr class="tr-separator" />` : ""}

        ${detailRow("Type", data.type.toUpperCase())}
        ${detailRow("Tx ID", txIDShort, true, data.txID)}
        ${detailRow("Confirmed Round", data.confirmedRound.toLocaleString())}
        ${detailRow("Date", dateStr)}
        ${detailRow("Fee", `${feeAlgo} ALGO`)}
        ${data.assetID ? detailRow("Asset ID", String(data.assetID)) : ""}

        <a class="tr-explorer-link" href="${data.explorerUrl}" target="_blank" rel="noopener noreferrer">
          View on Explorer ${externalLinkIcon()}
        </a>
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="tr-card loading">
      <div class="tr-loading-pulse"></div>
      <div class="tr-loading-text">Submitting transaction...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="tr-card error">
      <div class="tr-error-icon">!</div>
      <div class="tr-error-text">${message}</div>
    </div>`;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".tr-copy-inline");
  for (const btn of copyButtons) {
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
  }
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

const app = new App({ name: "txn-receipt-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as TxnReceiptStructuredContent | undefined;
  if (sc?.txnReceipt) {
    root.innerHTML = renderCard(sc.txnReceipt);
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
