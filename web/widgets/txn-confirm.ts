import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./txn-confirm.css";

type TxnType = "payment" | "asset-create" | "asset-optin" | "asset-transfer" | "usdc-optin";

interface TxnConfirmData {
  type: TxnType;
  txID: string;
  encodedTxn?: string;
  // payment & asset-transfer
  sender?: string;
  receiver?: string;
  amount?: number;
  // asset-create
  creator?: string;
  assetName?: string;
  unitName?: string;
  totalSupply?: number;
  decimals?: number;
  // asset-optin, asset-transfer & usdc-optin
  assetID?: number;
  // asset-optin & usdc-optin
  address?: string;
  // usdc-optin
  submitted?: boolean;
  // common
  fee: number;
  firstValid: number;
  lastValid: number;
}

interface TxnConfirmStructuredContent {
  txnConfirm: TxnConfirmData;
}

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function copyIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function checkIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function arrowDownIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
}

function copyBtn(text: string, title: string): string {
  return `<button class="tc-copy-inline" data-copy="${text}" title="${title}">${copyIcon()}</button>`;
}

function addrRow(label: string, addr: string): string {
  return `
    <div class="tc-address-row">
      <span class="tc-address-label">${label}</span>
      <span class="tc-address-value" title="${addr}">${truncateAddr(addr)}</span>
      ${copyBtn(addr, `Copy ${label.toLowerCase()} address`)}
    </div>`;
}

function detailRow(label: string, value: string, mono = false): string {
  return `
    <div class="tc-detail-row">
      <span class="tc-detail-label">${label}</span>
      <span class="tc-detail-value${mono ? " tc-mono" : ""}">${value}</span>
    </div>`;
}

function detailRowWithCopy(label: string, value: string, copyText: string): string {
  return `
    <div class="tc-detail-row">
      <span class="tc-detail-label">${label}</span>
      <span class="tc-detail-value tc-mono" title="${copyText}">${value}</span>
      ${copyBtn(copyText, `Copy ${label}`)}
    </div>`;
}

function headerMeta(type: TxnType): { icon: string; title: string; subtitle: string } {
  switch (type) {
    case "payment":
      return { icon: "💸", title: "Payment Transaction", subtitle: "Ready to sign and submit" };
    case "asset-create":
      return { icon: "🪙", title: "Asset Creation", subtitle: "New Algorand Standard Asset" };
    case "asset-optin":
      return { icon: "🔑", title: "Asset Opt-In", subtitle: "Authorize asset holding" };
    case "asset-transfer":
      return { icon: "🔄", title: "Asset Transfer", subtitle: "Ready to sign and submit" };
    case "usdc-optin":
      return { icon: "💵", title: "USDC Opt-In", subtitle: "Submitted to Algorand" };
  }
}

function renderCard(data: TxnConfirmData): string {
  const { icon, title, subtitle } = headerMeta(data.type);
  const feeAlgo = (data.fee / 1_000_000).toFixed(3);
  const txIDShort = truncateAddr(data.txID);

  let bodyContent = "";

  if (data.type === "payment") {
    const algoAmount = data.amount !== undefined
      ? (data.amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
      : "—";
    bodyContent = `
      <div class="tc-amount-section">
        <div class="tc-amount-label">Amount</div>
        <div class="tc-amount-value">${algoAmount}</div>
        <div class="tc-amount-asset">ALGO</div>
      </div>
      <hr class="tc-separator" />
      <div class="tc-address-section">
        ${addrRow("From", data.sender ?? "")}
        <div class="tc-arrow">${arrowDownIcon()}</div>
        ${addrRow("To", data.receiver ?? "")}
      </div>`;
  } else if (data.type === "asset-transfer") {
    bodyContent = `
      <div class="tc-amount-section">
        <div class="tc-amount-label">Amount</div>
        <div class="tc-amount-value">${(data.amount ?? 0).toLocaleString()}</div>
        <div class="tc-amount-asset">ASA #${data.assetID}</div>
      </div>
      <hr class="tc-separator" />
      <div class="tc-address-section">
        ${addrRow("From", data.sender ?? "")}
        <div class="tc-arrow">${arrowDownIcon()}</div>
        ${addrRow("To", data.receiver ?? "")}
      </div>`;
  } else if (data.type === "asset-optin") {
    bodyContent = `
      <div class="tc-amount-section">
        <div class="tc-amount-label">Asset ID</div>
        <div class="tc-amount-value">${data.assetID}</div>
        <div class="tc-amount-asset">Algorand Standard Asset</div>
      </div>
      <hr class="tc-separator" />
      <div class="tc-address-section">
        ${addrRow("Account", data.address ?? "")}
      </div>`;
  } else if (data.type === "asset-create") {
    bodyContent = `
      <div class="tc-amount-section">
        <div class="tc-amount-label">Asset</div>
        <div class="tc-amount-value">${data.assetName ?? "—"}</div>
        <div class="tc-amount-asset">${data.unitName ?? ""} · ${(data.totalSupply ?? 0).toLocaleString()} supply · ${data.decimals ?? 0} decimals</div>
      </div>
      <hr class="tc-separator" />
      <div class="tc-address-section">
        ${addrRow("Creator", data.creator ?? "")}
      </div>`;
  } else if (data.type === "usdc-optin") {
    bodyContent = `
      <div class="tc-amount-section">
        <div class="tc-amount-label">Asset</div>
        <div class="tc-amount-value">USDC</div>
        <div class="tc-amount-asset">ASA #31566704 · USD Coin on Algorand</div>
      </div>
      <hr class="tc-separator" />
      <div class="tc-address-section">
        ${addrRow("Account", data.address ?? "")}
      </div>`;
  }

  const badge = data.type === "usdc-optin"
    ? "Signed · Submitted"
    : "Unsigned · Encoded";

  return `
    <div class="tc-card">
      <div class="tc-header ${data.type}">
        <div class="tc-header-icon">${icon}</div>
        <div class="tc-header-title">${title}</div>
        <div class="tc-header-subtitle">${subtitle}</div>
        <div class="tc-badge">${badge}</div>
      </div>
      <div class="tc-body">
        ${bodyContent}
        <hr class="tc-separator" />
        ${detailRowWithCopy("Tx ID", txIDShort, data.txID)}
        ${detailRow("Fee", `${feeAlgo} ALGO`)}
        ${detailRow("Valid Rounds", `${data.firstValid} – ${data.lastValid}`)}
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="tc-card loading">
      <div class="tc-loading-pulse"></div>
      <div class="tc-loading-text">Loading transaction...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="tc-card error">
      <div class="tc-error-icon">!</div>
      <div class="tc-error-text">${message}</div>
    </div>`;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".tc-copy-inline");
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

const app = new App({ name: "txn-confirm-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as TxnConfirmStructuredContent | undefined;
  if (sc?.txnConfirm) {
    root.innerHTML = renderCard(sc.txnConfirm);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No transaction data returned.");
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
