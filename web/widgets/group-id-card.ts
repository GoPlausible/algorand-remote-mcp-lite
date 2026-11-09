import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./group-id-card.css";

interface GroupIdResult {
  groupId: string;
  txnCount: number;
}

interface GroupIdStructuredContent {
  groupIdResult: GroupIdResult;
}

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const GROUP_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="6" height="10" rx="1"/><rect x="9" y="7" width="6" height="10" rx="1"/><rect x="16" y="7" width="6" height="10" rx="1"/><path d="M5 7V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2"/><path d="M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2"/></svg>`;

function truncate(s: string): string {
  if (s.length <= 20) return s;
  return `${s.slice(0, 10)}...${s.slice(-8)}`;
}

function renderCard(data: GroupIdResult): string {
  return `
    <div class="gic-card">
      <div class="gic-header">
        <div class="gic-icon">${GROUP_SVG}</div>
        <div>
          <div class="gic-title">Group ID Assigned</div>
          <div class="gic-txn-count-badge">${data.txnCount} transaction${data.txnCount !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <div class="gic-id-section">
        <div class="gic-id-label">Group ID</div>
        <div class="gic-id-row">
          <span class="gic-id-value" title="${data.groupId}">${truncate(data.groupId)}</span>
          <button class="gic-copy-btn" id="gic-copy" title="Copy Group ID">${COPY_SVG}</button>
        </div>
      </div>

      <div class="gic-info">
        All ${data.txnCount} transactions share this group ID and will execute atomically — if any fails, all fail.
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="gic-card gic-loading">
      <div class="gic-loading-pulse"></div>
      <div class="gic-loading-text">Assigning group ID...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="gic-card gic-error">
      <div class="gic-error-icon">!</div>
      <div class="gic-error-text">${message}</div>
    </div>`;
}

function attachHandlers(data: GroupIdResult) {
  const copyBtn = root.querySelector<HTMLButtonElement>("#gic-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(data.groupId).then(() => {
        copyBtn.innerHTML = CHECK_COPY_SVG;
        copyBtn.classList.add("gic-copied");
        setTimeout(() => {
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.classList.remove("gic-copied");
        }, 2000);
      });
    });
  }
}

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

const app = new App({ name: "group-id-card-widget", version: "1.0.0" });

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as GroupIdStructuredContent | undefined;
  if (sc?.groupIdResult) {
    root.innerHTML = renderCard(sc.groupIdResult);
    attachHandlers(sc.groupIdResult);
  } else {
    root.innerHTML = renderError("No group ID data returned.");
  }
};

app.ontoolcancelled = () => { root.innerHTML = renderError("Request was cancelled."); };
app.onerror = (err) => {
  console.error("App error:", err);
  root.innerHTML = renderError("An error occurred.");
};

app.onhostcontextchanged = handleHostContextChanged;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
