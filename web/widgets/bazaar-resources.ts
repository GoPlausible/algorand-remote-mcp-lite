import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./bazaar-resources.css";

interface BazaarAccept {
  network?: string;
  mainnet?: boolean;
  scheme?: string;
  amount?: string;
  asset?: string;
  payTo?: string;
  usdPrice?: number | null;
}

interface BazaarItem {
  resourceUrl?: string;
  method?: string;
  description?: string;
  merchantId?: string;
  algorandPayable?: boolean;
  algorandAccepts?: BazaarAccept[];
  totalAcceptedNetworks?: number;
  otherNetworks?: string[];
  popularity?: { verifyCount?: number; settleCount?: number };
  firstSeen?: string;
  lastSeen?: string;
  id?: string;
}

interface BazaarData {
  source: string;
  mode: "list" | "search" | "details";
  query?: string;
  count: number;
  items: BazaarItem[];
}

interface BazaarStructuredContent {
  bazaar: BazaarData;
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

function displayUrl(url: string): string {
  const bare = url.replace(/^https?:\/\//, "");
  return bare.length <= 46 ? bare : `${bare.slice(0, 44)}…`;
}

function cheapestUsd(item: BazaarItem): number | null {
  const prices = (item.algorandAccepts ?? [])
    .map((a) => a.usdPrice)
    .filter((p): p is number => typeof p === "number");
  return prices.length > 0 ? Math.min(...prices) : null;
}

function priceChip(item: BazaarItem): string {
  const cheapest = cheapestUsd(item);
  if (cheapest === null) return "";
  return `<span class="bz-chip bz-chip-price">$${cheapest.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>`;
}

function copyIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function checkIcon(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function linkIcon(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
}

function renderAccept(accept: BazaarAccept): string {
  const usd =
    typeof accept.usdPrice === "number"
      ? `<span class="bz-accept-usd">$${accept.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>`
      : "";
  const networkChip = accept.mainnet
    ? `<span class="bz-chip bz-chip-mainnet">MainNet</span>`
    : `<span class="bz-chip" title="${esc(accept.network)}">${esc(truncate(String(accept.network ?? "?"), 20))}</span>`;
  return `
    <div class="bz-accept">
      ${networkChip}
      ${accept.scheme ? `<span class="bz-chip">${esc(accept.scheme)}</span>` : ""}
      ${usd}
      ${
        accept.payTo
          ? `<span class="bz-mono" title="${esc(accept.payTo)}">${esc(truncate(String(accept.payTo), 16))}</span>
             <button class="bz-copy" data-copy="${esc(accept.payTo)}" title="Copy address">${copyIcon()}</button>`
          : ""
      }
    </div>
  `;
}

function renderItem(item: BazaarItem, expanded: boolean): string {
  const url = String(item.resourceUrl ?? "");
  const payableBadge = item.algorandPayable
    ? `<span class="bz-chip bz-chip-mainnet">Algorand payable</span>`
    : `<span class="bz-chip bz-chip-muted">Not payable on MainNet</span>`;
  const popularity = item.popularity
    ? `<span class="bz-pop">${esc(item.popularity.verifyCount ?? 0)} verified · ${esc(item.popularity.settleCount ?? 0)} settled</span>`
    : "";
  const acceptsHtml =
    expanded && (item.algorandAccepts?.length ?? 0) > 0
      ? `<div class="bz-accepts">${(item.algorandAccepts ?? []).map(renderAccept).join("")}</div>`
      : "";

  return `
    <div class="bz-item">
      <div class="bz-item-top">
        ${item.method ? `<span class="bz-method">${esc(item.method)}</span>` : ""}
        <button class="bz-link" data-url="${esc(url)}" title="${esc(url)}">${esc(displayUrl(url))} ${linkIcon()}</button>
      </div>
      ${item.description ? `<div class="bz-desc">${esc(item.description)}</div>` : ""}
      <div class="bz-item-chips">
        ${priceChip(item)}
        ${payableBadge}
        ${popularity}
      </div>
      ${acceptsHtml}
    </div>
  `;
}

function renderCard(data: BazaarData): string {
  const subtitle =
    data.mode === "search"
      ? `Search: “${esc(data.query ?? "")}”`
      : data.mode === "details"
        ? "Resource details"
        : "Paid API directory";
  const items = Array.isArray(data.items) ? data.items : [];
  const expanded = data.mode === "details";
  const itemsHtml =
    items.length > 0
      ? items.map((it) => renderItem(it, expanded)).join("")
      : `<div class="bz-empty">No resources found.</div>`;

  return `
    <div class="bz-card">
      <div class="bz-header">
        <div class="bz-header-title">Bazaar Paid APIs</div>
        <div class="bz-header-sub">${subtitle} · ${esc(data.count)} result${data.count === 1 ? "" : "s"}</div>
      </div>
      <div class="bz-body">
        ${itemsHtml}
      </div>
      <div class="bz-footer">
        <span class="bz-source" title="${esc(data.source)}">${esc(displayUrl(String(data.source ?? "")))}</span>
      </div>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="bz-card loading">
      <div class="bz-loading-pulse"></div>
      <div class="bz-loading-text">Loading Bazaar resources...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="bz-card error">
      <div class="bz-error-icon">!</div>
      <div class="bz-error-text">${esc(message)}</div>
    </div>
  `;
}

function attachEventHandlers() {
  const copyButtons = root.querySelectorAll<HTMLButtonElement>(".bz-copy");
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

const app = new App({ name: "bazaar-resources-widget", version: "1.0.0" });

// Open resource URLs via host navigation (sandboxed iframe blocks href/window.open)
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
  const sc = result.structuredContent as BazaarStructuredContent | undefined;
  if (sc?.bazaar) {
    root.innerHTML = renderCard(sc.bazaar);
    attachEventHandlers();
  } else {
    root.innerHTML = renderError("No Bazaar data returned.");
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
