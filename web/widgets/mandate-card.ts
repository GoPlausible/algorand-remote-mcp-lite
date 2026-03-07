import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./mandate-card.css";

interface MandateItem {
  label: string;
  amount: { currency: string; value: string };
}

interface MandateData {
  type: "intent_mandate" | "cart_mandate" | "payment_mandate";
  id: string;
  currency: string;
  total: string;
  items: MandateItem[];
  merchantPublicKey: string;
  merchantAgent?: string;
  refundPeriod?: string;
  vcLink: string;
  createdAt: string;
}

interface MandateStructuredContent {
  mandate: MandateData;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

function formatMandateType(type: string): string {
  switch (type) {
    case "intent_mandate":
      return "Intent";
    case "cart_mandate":
      return "Cart";
    case "payment_mandate":
      return "Payment";
    default:
      return type.replace(/_/g, " ");
  }
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "intent_mandate":
      return "mc-badge-intent";
    case "cart_mandate":
      return "mc-badge-cart";
    case "payment_mandate":
      return "mc-badge-payment";
    default:
      return "mc-badge-intent";
  }
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
    });
  } catch {
    return iso;
  }
}

function formatAmount(value: string, currency: string): string {
  try {
    const num = parseFloat(value);
    if (isNaN(num)) return `${value} ${currency}`;
    return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${currency}`;
  } catch {
    return `${value} ${currency}`;
  }
}

function renderMandateCard(data: MandateData): string {
  const typeLabel = formatMandateType(data.type);
  const badgeClass = typeBadgeClass(data.type);

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr class="mc-item-row">
        <td class="mc-item-label">${item.label}</td>
        <td class="mc-item-amount">${formatAmount(item.amount.value, item.amount.currency)}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="mc-card">
      <div class="mc-header">
        <div class="mc-header-top">
          <span class="mc-title">AP2 Mandate</span>
          <span class="mc-badge ${badgeClass}">${typeLabel}</span>
        </div>
        <div class="mc-id" title="${data.id}">${data.id}</div>
      </div>

      <div class="mc-body">
        <table class="mc-items-table">
          <thead>
            <tr>
              <th class="mc-th-label">Item</th>
              <th class="mc-th-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr class="mc-total-row">
              <td class="mc-total-label">Total</td>
              <td class="mc-total-amount">${formatAmount(data.total, data.currency)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="mc-currency-badge">${data.currency}</div>

        <div class="mc-details">
          <div class="mc-detail-row">
            <span class="mc-detail-label">Merchant</span>
            <span class="mc-detail-value mc-mono" title="${data.merchantPublicKey}">${truncateAddress(data.merchantPublicKey)}</span>
          </div>
          ${data.merchantAgent ? `
          <div class="mc-detail-row">
            <span class="mc-detail-label">Agent</span>
            <span class="mc-detail-value mc-mono" title="${data.merchantAgent}">${truncateAddress(data.merchantAgent)}</span>
          </div>` : ""}
          ${data.refundPeriod ? `
          <div class="mc-detail-row">
            <span class="mc-detail-label">Refund Period</span>
            <span class="mc-detail-value">${data.refundPeriod}</span>
          </div>` : ""}
          <div class="mc-detail-row">
            <span class="mc-detail-label">VC Reference</span>
            <span class="mc-detail-value mc-mono" title="${data.vcLink}">${truncateAddress(data.vcLink)}</span>
          </div>
          <div class="mc-detail-row">
            <span class="mc-detail-label">Created</span>
            <span class="mc-detail-value">${formatTimestamp(data.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLoading(label?: string): string {
  return `
    <div class="mc-card mc-loading">
      <div class="mc-loading-pulse"></div>
      <div class="mc-loading-text">Loading ${label || "mandate"}...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="mc-card mc-error">
      <div class="mc-error-icon">!</div>
      <div class="mc-error-text">${message}</div>
    </div>
  `;
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

const app = new App({ name: "mandate-card-widget", version: "1.0.0" });

app.ontoolinput = (params) => {
  const args = params.arguments as { id?: string } | undefined;
  root.innerHTML = renderLoading(args?.id);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as { id?: string } | undefined;
  if (args?.id) {
    root.innerHTML = renderLoading(args.id);
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as MandateStructuredContent | undefined;
  if (sc?.mandate) {
    root.innerHTML = renderMandateCard(sc.mandate);
  } else {
    root.innerHTML = renderError("Mandate not found or no data returned.");
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
