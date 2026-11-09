import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./atomic-group-card.css";

interface AtomicGroupResult {
  groupId: string;
  txnCount: number;
}

interface AtomicGroupStructuredContent {
  atomicGroupResult: AtomicGroupResult;
}

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const SUCCESS_CHECK_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function truncate(s: string): string {
  if (s.length <= 20) return s;
  return `${s.slice(0, 10)}...${s.slice(-8)}`;
}

function renderCard(data: AtomicGroupResult): string {
  return `
    <div class="agc-card">
      <div class="agc-header">
        <div class="agc-check">${SUCCESS_CHECK_SVG}</div>
        <div>
          <div class="agc-title">Atomic Group Created</div>
          <div class="agc-txn-badge">${data.txnCount} transaction${data.txnCount !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <div class="agc-id-section">
        <div class="agc-id-label">Group ID</div>
        <div class="agc-id-row">
          <span class="agc-id-value" title="${data.groupId}">${truncate(data.groupId)}</span>
          <button class="agc-copy-btn" data-copy="${data.groupId}" title="Copy Group ID">${COPY_SVG}</button>
        </div>
      </div>

      <div class="agc-info">
        All ${data.txnCount} transactions are grouped atomically — they will either all succeed or all fail together.
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="agc-card agc-loading">
      <div class="agc-loading-pulse"></div>
      <div class="agc-loading-text">Creating atomic group...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="agc-card agc-error">
      <div class="agc-error-icon">!</div>
      <div class="agc-error-text">${message}</div>
    </div>`;
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

const app = new App({ name: "atomic-group-card-widget", version: "1.0.0" });

document.addEventListener("click", (e) => {
  const copyBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-copy]");
  if (copyBtn) {
    e.stopPropagation();
    const text = copyBtn.dataset.copy || "";
    navigator.clipboard.writeText(text).then(() => {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = CHECK_SVG;
      copyBtn.classList.add("agc-copied");
      setTimeout(() => {
        copyBtn.innerHTML = original;
        copyBtn.classList.remove("agc-copied");
      }, 1500);
    });
  }
});

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as AtomicGroupStructuredContent | undefined;
  if (sc?.atomicGroupResult) {
    root.innerHTML = renderCard(sc.atomicGroupResult);
  } else {
    root.innerHTML = renderError("No group data returned.");
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
