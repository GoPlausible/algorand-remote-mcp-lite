import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { esc } from "./alpha-escape";
import "./qr-code.css";

interface QrData {
  uriType: string;
  uri: string;
  qrCodeLink: string;
  qrImageData?: string;
  address: string;
  amount?: number;
  assetId?: number;
  note?: string;
  xnote?: string;
  decimals?: number;
}

interface QrStructuredContent {
  qrData: QrData;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function formatAmount(amount: number, decimals?: number): string {
  const dec = decimals ?? 6;
  const value = amount / 10 ** dec;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: dec,
  });
}

function getBadgeClass(uriType: string): string {
  const lower = uriType.toLowerCase();
  if (lower.includes("contact")) return "qr-badge-contact";
  if (lower.includes("payment")) return "qr-badge-payment";
  if (lower.includes("asset")) return "qr-badge-asset";
  return "qr-badge-contact";
}

function getBadgeLabel(uriType: string): string {
  return uriType;
}

function renderQrCard(data: QrData): string {
  const badgeClass = getBadgeClass(data.uriType);
  const badgeLabel = getBadgeLabel(data.uriType);

  const amountHtml = data.amount != null
    ? `<div class="qr-detail-row">
        <span class="qr-detail-label">Amount</span>
        <span class="qr-detail-value qr-mono">${formatAmount(data.amount, data.decimals)}</span>
      </div>`
    : "";

  const assetHtml = data.assetId != null
    ? `<div class="qr-detail-row">
        <span class="qr-detail-label">Asset ID</span>
        <span class="qr-detail-value qr-mono">${data.assetId}</span>
      </div>`
    : "";

  const noteHtml = data.note
    ? `<div class="qr-detail-row">
        <span class="qr-detail-label">Note</span>
        <span class="qr-detail-value qr-note">${esc(data.note)}</span>
      </div>`
    : "";

  const xnoteHtml = data.xnote
    ? `<div class="qr-detail-row">
        <span class="qr-detail-label">Locked note</span>
        <span class="qr-detail-value qr-note">${esc(data.xnote)}</span>
      </div>`
    : "";

  const qrImageSection = data.qrImageData
    ? `<div class="qr-image-section">
        <img
          class="qr-image"
          src="data:image/jpeg;base64,${data.qrImageData}"
          alt="ARC-90 QR Code"
          loading="eager"
        />
      </div>`
    : `<div class="qr-link-section">
        <button class="qr-open-btn" data-url="${data.qrCodeLink}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="3" height="3"/>
            <line x1="21" y1="14" x2="21" y2="17"/>
            <line x1="14" y1="21" x2="17" y2="21"/>
            <line x1="21" y1="21" x2="21" y2="21"/>
          </svg>
          Open QR Code
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
      </div>`;

  return `
    <div class="qr-card">
      <div class="qr-header">
        <div class="qr-header-content">
          <svg class="qr-header-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="3" height="3"/>
            <line x1="21" y1="14" x2="21" y2="17"/>
            <line x1="14" y1="21" x2="17" y2="21"/>
            <line x1="21" y1="21" x2="21" y2="21"/>
          </svg>
          <div>
            <h2 class="qr-title">Instant Topup QRCode</h2>
            <span class="qr-badge ${badgeClass}">${badgeLabel}</span>
          </div>
        </div>
      </div>

      ${qrImageSection}

      <div class="qr-details">
        <div class="qr-detail-row">
          <span class="qr-detail-label">Address</span>
          <span class="qr-detail-value qr-address" title="${data.address}">
            ${truncateAddress(data.address)}
            <button class="qr-copy-inline" data-copy="${data.address}" title="Copy address">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
          </span>
        </div>
        ${amountHtml}
        ${assetHtml}
        ${noteHtml}
        ${xnoteHtml}
        <div class="qr-detail-row">
          <span class="qr-detail-label">ARC-90 URI</span>
          <span class="qr-detail-value qr-uri-inline" title="${data.uri}">${data.uri.slice(0, 32)}…</span>
          <button class="qr-copy-inline" data-copy="${data.uri}" title="Copy URI">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="qr-footer-actions">
        <button class="qr-copy-btn" data-copy="${data.uri}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          Copy URI
        </button>
        <button class="qr-page-btn" data-url="${data.qrCodeLink}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Full Page
        </button>
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="qr-card loading">
      <div class="loading-pulse"></div>
      <div class="loading-text">Generating QR code...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="qr-card error">
      <div class="error-icon">!</div>
      <div class="error-text">${message}</div>
    </div>
  `;
}

function attachEventHandlers() {
  // Copy URI button
  const copyBtn = root.querySelector(".qr-copy-btn") as HTMLButtonElement | null;
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = copyBtn.dataset.copy || "";
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            Copy URI
          `;
        }, 2000);
      });
    });
  }

  // Inline copy buttons (address)
  const inlineCopyBtns = root.querySelectorAll(".qr-copy-inline");
  inlineCopyBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const target = btn as HTMLButtonElement;
      const text = target.dataset.copy || "";
      navigator.clipboard.writeText(text).then(() => {
        target.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          target.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
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

const app = new App({ name: "qr-code-widget", version: "1.0.0" });

// Handle external link clicks via host navigation (postMessage to host)
document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-url]");
  if (el) {
    const url = el.dataset.url;
    if (url) app.openLink({ url });
  }
});

app.ontoolinput = () => {
  root.innerHTML = renderLoading();
};

app.ontoolinputpartial = () => {
  root.innerHTML = renderLoading();
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as QrStructuredContent | undefined;
  if (sc?.qrData) {
    root.innerHTML = renderQrCard(sc.qrData);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("QR code data not found.");
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
