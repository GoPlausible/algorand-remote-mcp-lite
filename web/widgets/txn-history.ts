import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./txn-history.css";

const ALLO_SVG = `<svg width="16" height="16" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

interface Transaction {
  id: string;
  type: string;
  sender: string;
  fee: number;
  confirmedRound: number;
  roundTime: number;
  paymentTransaction?: { amount: number; receiver: string; closeRemainderTo?: string };
  assetTransferTransaction?: { assetId: number; amount: number; receiver: string; sender?: string };
  applicationTransaction?: { applicationId: number; onCompletion: string };
  note?: string;
  group?: string;
}

interface TxnHistoryData {
  address: string;
  transactions: Transaction[];
  totalTransactions: number;
  indexerNextToken: string | null;
}

interface TxnHistoryStructuredContent {
  txnHistory?: TxnHistoryData;
  address?: string;
  transactions?: Transaction[];
  totalTransactions?: number;
  indexerNextToken?: string | null;
}

// Track state for pagination — accumulate all loaded transactions
let currentAddress: string | null = null;
let allTransactions: Transaction[] = [];
let currentNextToken: string | null = null;
let isLoadingMore = false;

const TYPE_LABELS: Record<string, string> = {
  pay: "Payment",
  axfer: "Asset Transfer",
  appl: "App Call",
  acfg: "Asset Config",
  afrz: "Asset Freeze",
  keyreg: "Key Reg",
};

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function truncateTxId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatRelativeTime(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

function formatAlgo(microAlgos: number): string {
  return (microAlgos / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function extractData(sc: TxnHistoryStructuredContent): TxnHistoryData | null {
  if (sc.txnHistory) return sc.txnHistory;
  if (sc.address && sc.transactions) {
    return {
      address: sc.address,
      transactions: sc.transactions,
      totalTransactions: sc.totalTransactions ?? sc.transactions.length,
      indexerNextToken: sc.indexerNextToken ?? null,
    };
  }
  return null;
}

function getAmountInfo(txn: Transaction, address: string): { text: string; direction: "sent" | "received" | "neutral" } {
  if (txn.type === "pay" && txn.paymentTransaction) {
    const amt = formatAlgo(txn.paymentTransaction.amount);
    const isSender = txn.sender.toLowerCase() === address.toLowerCase();
    return {
      text: `${amt} ALGO`,
      direction: isSender ? "sent" : "received",
    };
  }
  if (txn.type === "axfer" && txn.assetTransferTransaction) {
    const at = txn.assetTransferTransaction;
    const isSender = txn.sender.toLowerCase() === address.toLowerCase();
    return {
      text: `${at.amount.toLocaleString()} ASA ${at.assetId}`,
      direction: isSender ? "sent" : "received",
    };
  }
  if (txn.type === "appl" && txn.applicationTransaction) {
    return {
      text: `App ${txn.applicationTransaction.applicationId}`,
      direction: "neutral",
    };
  }
  return { text: "-", direction: "neutral" };
}

function getFromTo(txn: Transaction, address: string): { from: string; to: string } {
  const from = txn.sender;
  let to = "";
  if (txn.type === "pay" && txn.paymentTransaction) {
    to = txn.paymentTransaction.receiver;
  } else if (txn.type === "axfer" && txn.assetTransferTransaction) {
    to = txn.assetTransferTransaction.receiver;
  } else if (txn.type === "appl" && txn.applicationTransaction) {
    to = `App ${txn.applicationTransaction.applicationId}`;
  }
  return { from, to };
}

function renderTxnRow(txn: Transaction, address: string): string {
  const typeLabel = TYPE_LABELS[txn.type] || txn.type;
  const amountInfo = getAmountInfo(txn, address);
  const { from, to } = getFromTo(txn, address);
  const timeStr = formatRelativeTime(txn.roundTime);

  const directionArrow =
    amountInfo.direction === "sent"
      ? '<span class="txn-arrow txn-arrow-sent">&#8593;</span>'
      : amountInfo.direction === "received"
        ? '<span class="txn-arrow txn-arrow-received">&#8595;</span>'
        : "";

  return `
    <div class="txn-row">
      <div class="txn-row-left">
        <span class="txn-type-badge txn-type-${txn.type}">${typeLabel}</span>
        <div class="txn-addresses">
          <span class="txn-from" title="${from}">${truncateAddress(from)}</span>
          ${to ? `<span class="txn-arrow-separator">&#8594;</span><span class="txn-to" title="${typeof to === 'string' && to.startsWith('App') ? to : to}">${typeof to === 'string' && to.startsWith('App') ? to : truncateAddress(to)}</span>` : ""}
        </div>
      </div>
      <div class="txn-row-right">
        <div class="txn-amount ${amountInfo.direction}">
          ${directionArrow}
          <span>${amountInfo.text}</span>
        </div>
        <div class="txn-meta">
          <span class="txn-time" title="Round ${txn.confirmedRound}">${timeStr}</span>
          <span class="txn-id" title="${txn.id}">${truncateTxId(txn.id)}</span>
          <a class="allo-link" href="https://allo.info/tx/${txn.id}" target="_blank" rel="noopener" title="View on allo.info">${ALLO_SVG}</a>
        </div>
      </div>
    </div>
  `;
}

function renderTxnHistory(address: string, transactions: Transaction[], nextToken: string | null): string {
  const loadMoreHtml = nextToken
    ? `
    <div class="txn-pagination">
      <button class="txn-page-btn" id="txn-load-more">
        Load More Transactions
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>`
    : "";

  const txnRows = transactions.length > 0
    ? transactions.map((txn) => renderTxnRow(txn, address)).join("")
    : '<div class="txn-empty">No transactions found.</div>';

  return `
    <div class="txn-card">
      <div class="txn-header">
        <div class="txn-header-top">
          <h2 class="txn-title">Transaction History</h2>
          <span class="txn-count">${transactions.length.toLocaleString()} txn${transactions.length !== 1 ? "s" : ""} loaded${nextToken ? " (more available)" : ""}</span>
        </div>
        <div class="txn-address-row">
          <span class="txn-address" title="${address}">${truncateAddress(address)}</span>
        </div>
      </div>
      <div class="txn-list" id="txn-list">
        ${txnRows}
      </div>
      ${loadMoreHtml}
    </div>
  `;
}

function renderLoading(address?: string): string {
  return `
    <div class="txn-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">Loading transactions${address ? ` for ${truncateAddress(address)}` : ""}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="txn-card error">
      <div class="error-icon">!</div>
      <div class="error-text">${message}</div>
    </div>
  `;
}

function attachLoadMoreHandler() {
  if (!currentNextToken || !currentAddress) return;

  const loadMoreBtn = root.querySelector("#txn-load-more") as HTMLButtonElement | null;
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      if (isLoadingMore) return;
      loadMoreTransactions();
    });
  }
}

async function loadMoreTransactions() {
  if (!currentAddress || !currentNextToken || isLoadingMore) return;
  isLoadingMore = true;

  // Show loading state on the button
  const loadMoreBtn = root.querySelector("#txn-load-more") as HTMLButtonElement | null;
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Loading...";
  }

  try {
    const result = await app.callServerTool({
      name: "indexer_lookup_account_transactions",
      arguments: {
        address: currentAddress,
        nextToken: currentNextToken,
      },
    });

    const sc = result.structuredContent as TxnHistoryStructuredContent | undefined;
    if (sc) {
      const data = extractData(sc);
      if (data) {
        // Accumulate transactions
        allTransactions = [...allTransactions, ...data.transactions];
        currentNextToken = data.indexerNextToken;
        root.innerHTML = renderTxnHistory(currentAddress!, allTransactions, currentNextToken);
        attachLoadMoreHandler();
        return;
      }
    }
    // Restore on failure
    root.innerHTML = renderTxnHistory(currentAddress!, allTransactions, currentNextToken);
    attachLoadMoreHandler();
  } catch (err: any) {
    console.error("Failed to load more transactions:", err);
    root.innerHTML = renderTxnHistory(currentAddress!, allTransactions, currentNextToken);
    attachLoadMoreHandler();
  } finally {
    isLoadingMore = false;
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

const app = new App({ name: "txn-history-widget", version: "1.0.0" });

app.ontoolinput = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  root.innerHTML = renderLoading(args?.address);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { address?: string } | undefined;
  if (args?.address) {
    root.innerHTML = renderLoading(args.address);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as TxnHistoryStructuredContent | undefined;
  if (sc) {
    const data = extractData(sc);
    if (data) {
      currentAddress = data.address;
      allTransactions = data.transactions;
      currentNextToken = data.indexerNextToken;
      root.innerHTML = renderTxnHistory(data.address, allTransactions, currentNextToken);
      attachLoadMoreHandler();
      return;
    }
  }
  root.innerHTML = renderError("No transaction data returned.");
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
