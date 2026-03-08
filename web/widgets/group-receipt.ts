import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./group-receipt.css";

interface GroupTxnInfo {
  txID: string;
  type: string;
  sender: string;
  receiver?: string;
  amount?: number;
  assetID?: number;
  fee: number;
}

interface GroupReceiptData {
  groupTxID: string;
  confirmedRound: number;
  date: string;
  txnCount: number;
  totalFees: number;
  involvedAddresses: string[];
  transactions: GroupTxnInfo[];
  network: string;
  explorerUrl: string;
}

interface GroupReceiptStructuredContent {
  groupReceipt: GroupReceiptData;
}

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function copyIcon(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function checkIcon(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function checkCircleIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function externalLinkIcon(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
}

function copyBtn(text: string, cls: string): string {
  return `<button class="${cls}" data-copy="${text}" title="Copy">${copyIcon()}</button>`;
}

function typePill(type: string, prefix = "gr"): string {
  const cls = ["pay", "axfer", "acfg", "appl"].includes(type)
    ? `${prefix}-type-${type}`
    : `${prefix}-type-other`;
  const labels: Record<string, string> = {
    pay: "Pay",
    axfer: "Xfer",
    acfg: "Cfg",
    appl: "App",
    afrz: "Freeze",
    keyreg: "KeyReg",
  };
  return `<span class="${prefix}-type-pill ${cls}">${labels[type] ?? type.toUpperCase()}</span>`;
}

function formatAmountInline(amount: number, type: string, assetID?: number): string {
  if (type === "pay") {
    return `${(amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ALGO`;
  }
  if (type === "axfer") {
    if (assetID === 31566704) return `${(amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC`;
    if (assetID === 312769) return `${(amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDt`;
    return `${amount.toLocaleString()} u`;
  }
  return "";
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

function renderTxnItem(txn: GroupTxnInfo, idx: number): string {
  const idShort = truncateAddr(txn.txID);
  const hasAmount = txn.amount !== undefined && (txn.type === "pay" || txn.type === "axfer");
  const amountStr = hasAmount ? formatAmountInline(txn.amount!, txn.type, txn.assetID) : "";

  const senderRow = `
    <div class="gr-txn-addr-row">
      <span class="gr-txn-addr-label">From</span>
      <span class="gr-txn-addr-value" title="${txn.sender}">${truncateAddr(txn.sender)}</span>
      ${amountStr ? `<span class="gr-txn-amount">${amountStr}</span>` : ""}
    </div>`;

  const receiverRow = txn.receiver && txn.receiver !== txn.sender
    ? `<div class="gr-txn-addr-row">
        <span class="gr-txn-addr-label">To</span>
        <span class="gr-txn-addr-value" title="${txn.receiver}">${truncateAddr(txn.receiver)}</span>
      </div>`
    : "";

  return `
    <div class="gr-txn-item">
      <div class="gr-txn-header">
        <span class="gr-txn-idx">${idx + 1}</span>
        <span class="gr-txn-id-short" title="${txn.txID}">${idShort}</span>
        ${copyBtn(txn.txID, "gr-copy-inline")}
        ${typePill(txn.type)}
      </div>
      <div class="gr-txn-body">
        ${senderRow}
        ${receiverRow}
      </div>
    </div>`;
}

function renderAddressChips(addresses: string[]): string {
  return addresses.map((addr) => `
    <div class="gr-addr-chip">
      <span class="gr-addr-chip-text" title="${addr}">${truncateAddr(addr)}</span>
      ${copyBtn(addr, "gr-copy-inline")}
    </div>`).join("");
}

function detailRow(label: string, value: string, mono = false, copyText?: string): string {
  const valueClass = `gr-detail-value${mono ? " gr-mono" : ""}`;
  const copy = copyText ? copyBtn(copyText, "gr-copy-inline") : "";
  return `
    <div class="gr-detail-row">
      <span class="gr-detail-label">${label}</span>
      <span class="${valueClass}" title="${copyText ?? value}">${value}</span>
      ${copy}
    </div>`;
}

function renderCard(data: GroupReceiptData): string {
  const totalFeesAlgo = (data.totalFees / 1_000_000).toFixed(3);
  const txIDShort = truncateAddr(data.groupTxID);
  const dateStr = formatDate(data.date);
  const networkLabel = data.network === "mainnet" ? "Mainnet" : data.network === "testnet" ? "Testnet" : data.network;

  const txnItems = data.transactions.map((t, i) => renderTxnItem(t, i)).join("");
  const addrChips = renderAddressChips(data.involvedAddresses);

  return `
    <div class="gr-card">
      <div class="gr-header">
        <div class="gr-header-top">
          <div class="gr-check">${checkCircleIcon()}</div>
          <div class="gr-header-title">Atomic Group Confirmed</div>
        </div>
        <div class="gr-header-subtitle">Round ${data.confirmedRound.toLocaleString()} · ${networkLabel}</div>
        <div class="gr-badge">✓ ${data.txnCount} Transactions</div>
      </div>

      <div class="gr-stats">
        <div class="gr-stat">
          <div class="gr-stat-value">${data.txnCount}</div>
          <div class="gr-stat-label">Txns</div>
        </div>
        <div class="gr-stat">
          <div class="gr-stat-value">${data.involvedAddresses.length}</div>
          <div class="gr-stat-label">Accounts</div>
        </div>
        <div class="gr-stat">
          <div class="gr-stat-value">${totalFeesAlgo}</div>
          <div class="gr-stat-label">Total Fees</div>
        </div>
      </div>

      <div class="gr-body">
        <div class="gr-section-label">Transactions</div>
        <div class="gr-txn-list">${txnItems}</div>

        <hr class="gr-separator" />

        <div class="gr-section-label">Involved Accounts</div>
        <div class="gr-addresses" style="margin-bottom: 16px;">${addrChips}</div>

        <hr class="gr-separator" />

        ${detailRow("Group Tx ID", txIDShort, true, data.groupTxID)}
        ${detailRow("Confirmed Round", data.confirmedRound.toLocaleString())}
        ${detailRow("Date", dateStr)}
        ${detailRow("Total Fees", `${totalFeesAlgo} ALGO`)}

        <a class="gr-explorer-link" href="${data.explorerUrl}" target="_blank" rel="noopener noreferrer">
          View on Explorer ${externalLinkIcon()}
        </a>
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="gr-card loading">
      <div class="gr-loading-pulse"></div>
      <div class="gr-loading-text">Submitting transaction group...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="gr-card error">
      <div class="gr-error-icon">!</div>
      <div class="gr-error-text">${message}</div>
    </div>`;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".gr-copy-inline");
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

const app = new App({ name: "group-receipt-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as GroupReceiptStructuredContent | undefined;
  if (sc?.groupReceipt) {
    root.innerHTML = renderCard(sc.groupReceipt);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No group receipt data returned.");
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
