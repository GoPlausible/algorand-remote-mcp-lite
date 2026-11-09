import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./swap-result-card.css";

interface SwapSummary {
  inputAssetId: string;
  outputAssetId: string;
  inputAmount: string;
  outputAmount: string;
  totalFees: string;
  transactionCount: number;
  inputTxnId?: string;
  outputTxnId?: string;
}

interface SwapQuote {
  fromASAID: number;
  toASAID: number;
  expectedOutput: string;
  inputAmount: string;
  type: string;
  usdIn?: number;
  usdOut?: number;
  userPriceImpact?: number;
  route?: any[];
}

interface SwapResultData {
  status: string;
  confirmedRound: string;
  txIds: string[];
  signer: string;
  network: string;
  quote: SwapQuote;
  slippage: number;
  summary?: SwapSummary;
  inputTransactionId?: string;
}

interface SwapResultStructuredContent {
  swapResult: SwapResultData;
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

function arrowRightIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
}

function assetLabel(asaId: number | string): string {
  const id = Number(asaId);
  if (id === 0) return "ALGO";
  if (id === 31566704) return "USDC";
  if (id === 312769) return "USDt";
  return `ASA #${id}`;
}

function formatAmount(amount: string | number, asaId: number | string): string {
  const id = Number(asaId);
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  // ALGO and most 6-decimal assets
  if (id === 0 || id === 31566704 || id === 312769) {
    return (n / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }
  return n.toLocaleString();
}

function impactClass(impact: number): string {
  if (Math.abs(impact) < 0.5) return "sr-good";
  if (Math.abs(impact) < 2) return "";
  return "sr-warn";
}

function copyBtn(text: string, title: string): string {
  return `<button class="sr-copy-inline" data-copy="${text}" title="${title}">${copyIcon()}</button>`;
}

function detailRow(label: string, value: string, cls = "", withCopy?: string): string {
  const copy = withCopy ? copyBtn(withCopy, `Copy ${label}`) : "";
  return `
    <div class="sr-detail-row">
      <span class="sr-detail-label">${label}</span>
      <span class="sr-detail-value${cls ? ` ${cls}` : ""}" title="${withCopy ?? value}">${value}</span>
      ${copy}
    </div>`;
}

function routePills(route: any[]): string {
  if (!route?.length) return "";
  const names = route.map((r: any) => {
    if (typeof r === "string") return r;
    return r?.protocol ?? r?.name ?? JSON.stringify(r).slice(0, 12);
  });
  const pills = names.map((n: string) => `<span class="sr-route-pill">${n}</span>`).join("");
  return `
    <div class="sr-detail-row" style="flex-direction:column; align-items:flex-start; gap:6px;">
      <span class="sr-detail-label">Route</span>
      <div class="sr-route">${pills}</div>
    </div>`;
}

function renderCard(data: SwapResultData): string {
  const q = data.quote;
  const s = data.summary;

  const inputAsaId = s ? s.inputAssetId : String(q.fromASAID);
  const outputAsaId = s ? s.outputAssetId : String(q.toASAID);
  const inputAmt = s ? s.inputAmount : q.inputAmount;
  const outputAmt = s ? s.outputAmount : q.expectedOutput;

  const inputLabel = assetLabel(inputAsaId);
  const outputLabel = assetLabel(outputAsaId);
  const inputFmt = formatAmount(inputAmt, inputAsaId);
  const outputFmt = formatAmount(outputAmt, outputAsaId);

  const usdInStr = q.usdIn !== undefined ? `≈ $${Number(q.usdIn).toFixed(2)}` : "";
  const usdOutStr = q.usdOut !== undefined ? `≈ $${Number(q.usdOut).toFixed(2)}` : "";

  const impact = q.userPriceImpact ?? 0;
  const impactStr = `${Math.abs(impact).toFixed(3)}%`;

  const primaryTxId = data.inputTransactionId ?? (data.txIds?.[0] ?? "");
  const txIdShort = truncateAddr(primaryTxId);

  const routeArr = Array.isArray(q.route) ? q.route : [];

  return `
    <div class="sr-card">
      <div class="sr-header">
        <div class="sr-header-top">
          <div class="sr-check">${checkCircleIcon()}</div>
          <div class="sr-header-title">Swap Executed</div>
        </div>
        <div class="sr-header-subtitle">${inputLabel} → ${outputLabel} · Round ${data.confirmedRound}</div>
        <div class="sr-badge">Confirmed · ${data.network}</div>
      </div>

      <div class="sr-body">
        <div class="sr-swap-flow">
          <div class="sr-asset-box">
            <div class="sr-asset-amount">${inputFmt}</div>
            <div class="sr-asset-label">${inputLabel}</div>
            ${usdInStr ? `<div class="sr-asset-usd">${usdInStr}</div>` : ""}
          </div>
          <div class="sr-arrow">${arrowRightIcon()}</div>
          <div class="sr-asset-box">
            <div class="sr-asset-amount">${outputFmt}</div>
            <div class="sr-asset-label">${outputLabel}</div>
            ${usdOutStr ? `<div class="sr-asset-usd">${usdOutStr}</div>` : ""}
          </div>
        </div>

        <hr class="sr-separator" />

        ${detailRow("Price Impact", impactStr, impactClass(impact))}
        ${detailRow("Slippage", `${data.slippage}%`)}
        ${s ? detailRow("Fees", formatAmount(s.totalFees, 0) + " ALGO") : ""}
        ${s?.transactionCount ? detailRow("Transactions", String(s.transactionCount)) : ""}

        <hr class="sr-separator" />

        ${primaryTxId ? detailRow("Tx ID", txIdShort, "sr-mono", primaryTxId) : ""}
        ${routeArr.length ? routePills(routeArr) : ""}
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="sr-card loading">
      <div class="sr-loading-pulse"></div>
      <div class="sr-loading-text">Executing swap...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="sr-card error">
      <div class="sr-error-icon">!</div>
      <div class="sr-error-text">${message}</div>
    </div>`;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".sr-copy-inline");
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

const app = new App({ name: "swap-result-card-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as SwapResultStructuredContent | undefined;
  if (sc?.swapResult) {
    root.innerHTML = renderCard(sc.swapResult);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No swap result data returned.");
  }
};

app.ontoolcancelled = () => {
  root.innerHTML = renderError("Swap was cancelled.");
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
