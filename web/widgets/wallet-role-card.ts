import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./wallet-role-card.css";

interface RoleData {
  role: string | null;
  user: string;
  provider: string;
}

interface RoleStructuredContent {
  roleData: RoleData;
}

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const EYE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

const SHIELD_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

function truncate(s: string): string {
  return s.length <= 24 ? s : `${s.slice(0, 12)}...${s.slice(-8)}`;
}

function renderCard(data: RoleData): string {
  const role = data.role ?? "—";
  return `
    <div class="wrc-card">
      <div class="wrc-header">
        <div class="wrc-icon">${SHIELD_SVG}</div>
        <div class="wrc-title-group">
          <div class="wrc-title">Vault Role ID</div>
          <div class="wrc-subtitle">Hashicorp Vault · OIDC</div>
        </div>
      </div>

      <div class="wrc-warning">
        <div class="wrc-warning-icon">⚠</div>
        <div class="wrc-warning-text">
          <strong>Sensitive credential.</strong> This Role ID grants Vault access. Never share it, log it, or expose it in any output beyond this secure widget.
        </div>
      </div>

      <div class="wrc-role-section">
        <div class="wrc-role-label">Role ID</div>
        <div class="wrc-role-row">
          <span class="wrc-role-value wrc-mono" id="wrc-role-display" data-revealed="false" data-value="${role}">${role !== "—" ? "••••••••••••••••••••" : "—"}</span>
          <div class="wrc-role-actions">
            ${role !== "—" ? `
            <button class="wrc-action-btn" id="wrc-reveal-btn" title="Show/hide Role ID">${EYE_SVG}</button>
            <button class="wrc-action-btn" id="wrc-copy-btn" title="Copy Role ID">${COPY_SVG}</button>
            ` : ""}
          </div>
        </div>
      </div>

      <div class="wrc-details">
        <div class="wrc-detail-row">
          <span class="wrc-detail-label">User</span>
          <span class="wrc-detail-value">${data.user}</span>
        </div>
        <div class="wrc-detail-row">
          <span class="wrc-detail-label">Provider</span>
          <span class="wrc-detail-value wrc-capitalize">${data.provider}</span>
        </div>
      </div>

      <div class="wrc-footer-warning">
        Do not share this Role ID. Treat it like a password.
      </div>
    </div>`;
}

function renderLoading(): string {
  return `
    <div class="wrc-card wrc-loading">
      <div class="wrc-loading-pulse"></div>
      <div class="wrc-loading-text">Loading role info...</div>
    </div>`;
}

function renderError(message: string): string {
  return `
    <div class="wrc-card wrc-error">
      <div class="wrc-error-icon">!</div>
      <div class="wrc-error-text">${message}</div>
    </div>`;
}

function attachHandlers() {
  const display = root.querySelector<HTMLElement>("#wrc-role-display");
  const revealBtn = root.querySelector<HTMLButtonElement>("#wrc-reveal-btn");
  const copyBtn = root.querySelector<HTMLButtonElement>("#wrc-copy-btn");

  if (revealBtn && display) {
    revealBtn.addEventListener("click", () => {
      const isRevealed = display.dataset.revealed === "true";
      const value = display.dataset.value ?? "";
      if (isRevealed) {
        display.textContent = "••••••••••••••••••••";
        display.dataset.revealed = "false";
        revealBtn.innerHTML = EYE_SVG;
        revealBtn.title = "Show Role ID";
      } else {
        display.textContent = truncate(value);
        display.dataset.revealed = "true";
        revealBtn.innerHTML = EYE_OFF_SVG;
        revealBtn.title = "Hide Role ID";
      }
    });
  }

  if (copyBtn && display) {
    copyBtn.addEventListener("click", () => {
      const value = display.dataset.value ?? "";
      navigator.clipboard.writeText(value).then(() => {
        copyBtn.innerHTML = CHECK_SVG;
        copyBtn.classList.add("wrc-copied");
        setTimeout(() => {
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.classList.remove("wrc-copied");
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

const app = new App({ name: "wallet-role-card-widget", version: "1.0.0" });

app.ontoolinput = () => { root.innerHTML = renderLoading(); };
app.ontoolinputpartial = () => { root.innerHTML = renderLoading(); };

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as RoleStructuredContent | undefined;
  if (sc?.roleData) {
    root.innerHTML = renderCard(sc.roleData);
    attachHandlers();
  } else {
    root.innerHTML = renderError("No role data returned.");
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
