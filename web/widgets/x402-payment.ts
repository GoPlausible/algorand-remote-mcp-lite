import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./x402-payment.css";

interface PaidSummary {
  network?: string;
  asset?: string;
  assetName?: string;
  decimals?: number;
  amount?: string;
  usdPrice?: number | null;
  payTo?: string;
}

interface PaymentData {
  endpoint: string;
  method: string;
  status: number;
  paid: PaidSummary;
  paymentResponse?: unknown;
  resultPreview?: string;
}

interface PaymentStructuredContent {
  payment: PaymentData;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncate(value: string, max = 24): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

function assetLabel(paid: PaidSummary): string {
  if (paid.assetName) return paid.assetName;
  if (paid.asset === "0" || paid.asset === "" || paid.asset === undefined) return "ALGO";
  return `ASA ${paid.asset}`;
}

function prettyAmount(paid: PaidSummary): string {
  const decimals = typeof paid.decimals === "number" ? paid.decimals : 6;
  const n = Number(paid.amount);
  if (!Number.isFinite(n)) return String(paid.amount ?? "?");
  return (n / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function copyIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function checkIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

/** Render up to 6 key/value rows from the facilitator's payment-response object. */
function renderPaymentResponse(paymentResponse: unknown): string {
  if (!paymentResponse || typeof paymentResponse !== "object") return "";
  const entries = Object.entries(paymentResponse as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 6);
  if (entries.length === 0) return "";

  const rows = entries
    .map(([key, value]) => {
      const text = String(value);
      const isLong = text.length > 24;
      return `
        <div class="xp-row">
          <span class="xp-label">${esc(key)}</span>
          <span class="xp-mono" title="${esc(text)}">${esc(truncate(text))}</span>
          ${isLong ? `<button class="xp-copy" data-copy="${esc(text)}" title="Copy ${esc(key)}">${copyIcon()}</button>` : ""}
        </div>`;
    })
    .join("");

  return `
    <div class="xp-section">
      <div class="xp-section-title">Settlement</div>
      ${rows}
    </div>
  `;
}

function renderCard(data: PaymentData): string {
  const ok = data.status >= 200 && data.status < 300;
  const statusChip = ok
    ? `<span class="xp-status xp-status-ok">HTTP ${esc(data.status)}</span>`
    : `<span class="xp-status xp-status-bad">HTTP ${esc(data.status)}</span>`;

  const usd =
    typeof data.paid?.usdPrice === "number"
      ? `<span class="xp-usd">≈ $${data.paid.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>`
      : "";

  const previewHtml = data.resultPreview
    ? `<div class="xp-section">
        <div class="xp-section-title">Response preview</div>
        <pre class="xp-preview">${esc(data.resultPreview)}</pre>
      </div>`
    : "";

  return `
    <div class="xp-card">
      <div class="xp-header">
        <div class="xp-header-top">
          <div class="xp-header-title">x402 Paid Request</div>
          ${statusChip}
        </div>
        <div class="xp-endpoint">
          <span class="xp-method">${esc(data.method)}</span>
          <span class="xp-url" title="${esc(data.endpoint)}">${esc(truncate(String(data.endpoint), 52))}</span>
        </div>
      </div>
      <div class="xp-body">
        <div class="xp-paid">
          <div class="xp-paid-label">Paid</div>
          <div class="xp-paid-amount">
            <span class="xp-amount">${esc(prettyAmount(data.paid ?? {}))}</span>
            <span class="xp-asset">${esc(assetLabel(data.paid ?? {}))}</span>
            ${usd}
          </div>
          <div class="xp-paid-net">
            <span class="xp-chip xp-chip-mainnet">Algorand MainNet</span>
          </div>
          ${
            data.paid?.payTo
              ? `<div class="xp-row">
                  <span class="xp-label">Pay to</span>
                  <span class="xp-mono" title="${esc(data.paid.payTo)}">${esc(truncate(String(data.paid.payTo)))}</span>
                  <button class="xp-copy" data-copy="${esc(data.paid.payTo)}" title="Copy address">${copyIcon()}</button>
                </div>`
              : ""
          }
        </div>
        ${renderPaymentResponse(data.paymentResponse)}
        ${previewHtml}
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="xp-card loading">
      <div class="xp-loading-pulse"></div>
      <div class="xp-loading-text">Paying and calling the endpoint...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="xp-card error">
      <div class="xp-error-icon">!</div>
      <div class="xp-error-text">${esc(message)}</div>
    </div>
  `;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".xp-copy");
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

const app = new App({ name: "x402-payment-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as PaymentStructuredContent | undefined;
  if (sc?.payment) {
    root.innerHTML = renderCard(sc.payment);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No payment data returned.");
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
