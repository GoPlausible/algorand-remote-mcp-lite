import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./x402-requirements.css";

interface RequirementSummary {
  scheme?: string;
  network?: string;
  mainnet?: boolean;
  amount?: string;
  asset?: string;
  assetName?: string;
  decimals?: number;
  usdPrice?: number | null;
  payTo?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
}

interface DiscoveryData {
  endpoint: string;
  method: string;
  status: number;
  x402: boolean;
  x402Version?: number;
  accepts: RequirementSummary[];
}

interface DiscoveryStructuredContent {
  discovery: DiscoveryData;
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

function assetLabel(req: RequirementSummary): string {
  if (req.assetName) return req.assetName;
  if (req.asset === "0" || req.asset === "" || req.asset === undefined) return "ALGO";
  return `ASA ${req.asset}`;
}

function prettyAmount(req: RequirementSummary): string {
  const decimals = typeof req.decimals === "number" ? req.decimals : 6;
  const n = Number(req.amount);
  if (!Number.isFinite(n)) return String(req.amount ?? "?");
  return (n / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function copyIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function checkIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function renderRequirement(req: RequirementSummary): string {
  const usd =
    typeof req.usdPrice === "number"
      ? `<span class="xr-usd">≈ $${req.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>`
      : "";
  const networkChip = req.mainnet
    ? `<span class="xr-chip xr-chip-mainnet">Algorand MainNet</span>`
    : `<span class="xr-chip xr-chip-other" title="${esc(req.network)}">${esc(truncate(String(req.network ?? "unknown"), 26))}</span>`;
  const descriptionHtml = req.description
    ? `<div class="xr-req-desc">${esc(req.description)}</div>`
    : "";

  return `
    <div class="xr-req">
      <div class="xr-req-price">
        <span class="xr-amount">${esc(prettyAmount(req))}</span>
        <span class="xr-asset">${esc(assetLabel(req))}</span>
        ${usd}
      </div>
      <div class="xr-req-chips">
        ${networkChip}
        ${req.scheme ? `<span class="xr-chip">${esc(req.scheme)}</span>` : ""}
      </div>
      ${descriptionHtml}
      ${
        req.payTo
          ? `<div class="xr-req-row">
              <span class="xr-label">Pay to</span>
              <span class="xr-mono" title="${esc(req.payTo)}">${esc(truncate(String(req.payTo)))}</span>
              <button class="xr-copy" data-copy="${esc(req.payTo)}" title="Copy address">${copyIcon()}</button>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderCard(data: DiscoveryData): string {
  const statusHtml = data.x402
    ? `<div class="xr-status xr-status-paid">Payment required · x402 v${esc(data.x402Version ?? "?")}</div>`
    : `<div class="xr-status xr-status-free">No payment required (HTTP ${esc(data.status)})</div>`;

  const accepts = Array.isArray(data.accepts) ? data.accepts : [];
  const acceptsHtml = data.x402
    ? accepts.length > 0
      ? accepts.map(renderRequirement).join("")
      : `<div class="xr-empty">The endpoint returned no payment options.</div>`
    : "";

  return `
    <div class="xr-card">
      <div class="xr-header">
        <div class="xr-header-title">x402 Payment Requirements</div>
        <div class="xr-endpoint">
          <span class="xr-method">${esc(data.method)}</span>
          <span class="xr-url" title="${esc(data.endpoint)}">${esc(truncate(String(data.endpoint), 52))}</span>
        </div>
      </div>
      <div class="xr-body">
        ${statusHtml}
        ${acceptsHtml}
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="xr-card loading">
      <div class="xr-loading-pulse"></div>
      <div class="xr-loading-text">Probing endpoint for payment requirements...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="xr-card error">
      <div class="xr-error-icon">!</div>
      <div class="xr-error-text">${esc(message)}</div>
    </div>
  `;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".xr-copy");
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

const app = new App({ name: "x402-requirements-widget", version: "1.0.0" });

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as DiscoveryStructuredContent | undefined;
  if (sc?.discovery) {
    root.innerHTML = renderCard(sc.discovery);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No discovery data returned.");
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
