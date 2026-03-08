import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./indexer-search.css";

const ALLO_SVG = `<svg width="16" height="16" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

type SearchType = "accounts" | "transactions" | "assets" | "applications";

interface IndexerSearchData {
  type: SearchType;
  results: any[];
  totalResults: number;
  nextToken: string | null;
  query: Record<string, any>;
}

interface IndexerSearchStructuredContent {
  indexerSearch: IndexerSearchData;
}

function truncate(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function formatAlgo(microAlgos: number): string {
  const algos = microAlgos / 1_000_000;
  return algos.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function renderQueryBadges(query: Record<string, any>): string {
  const badges: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    const display = typeof value === "string" && value.length > 16
      ? truncate(value)
      : String(value);
    badges.push(`<span class="is-query-badge">${key}: ${display}</span>`);
  }
  return badges.length > 0 ? `<div class="is-queries">${badges.join("")}</div>` : "";
}

function renderAccountsTable(results: any[]): string {
  const rows = results.map((acct, i) => {
    const addr = truncate(acct.address || "");
    const balance = formatAlgo(acct.amount ?? 0);
    const status = acct.status || "Offline";
    const rowClass = i % 2 === 1 ? " is-row-alt" : "";
    return `
      <tr class="is-row${rowClass}">
        <td class="is-cell is-mono" title="${acct.address || ""}">${addr}</td>
        <td class="is-cell is-right">${balance}</td>
        <td class="is-cell">${status}</td>
        <td class="is-cell"><button class="allo-link" data-url="https://allo.info/account/${acct.address}" title="View on allo.info">${ALLO_SVG}</button></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="is-table-wrap">
      <table class="is-table">
        <thead>
          <tr class="is-thead-row">
            <th class="is-th">Address</th>
            <th class="is-th is-right">Balance (ALGO)</th>
            <th class="is-th">Status</th>
            <th class="is-th"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderTransactionsTable(results: any[]): string {
  const rows = results.map((txn, i) => {
    const txId = truncate(txn.id || "");
    const txType = txn["tx-type"] || txn.type || "-";
    const sender = truncate(txn.sender || "");
    const round = txn["confirmed-round"] ?? txn.round ?? "-";
    const rowClass = i % 2 === 1 ? " is-row-alt" : "";
    return `
      <tr class="is-row${rowClass}">
        <td class="is-cell is-mono" title="${txn.id || ""}">${txId}</td>
        <td class="is-cell">${txType}</td>
        <td class="is-cell is-mono" title="${txn.sender || ""}">${sender}</td>
        <td class="is-cell is-right">${round}</td>
        <td class="is-cell"><button class="allo-link" data-url="https://allo.info/tx/${txn.id}" title="View on allo.info">${ALLO_SVG}</button></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="is-table-wrap">
      <table class="is-table">
        <thead>
          <tr class="is-thead-row">
            <th class="is-th">TX ID</th>
            <th class="is-th">Type</th>
            <th class="is-th">Sender</th>
            <th class="is-th is-right">Round</th>
            <th class="is-th"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderAssetsTable(results: any[]): string {
  const rows = results.map((asset, i) => {
    const id = asset.index ?? asset.id ?? "-";
    const name = asset.params?.name || "Unnamed";
    const unitName = asset.params?.["unit-name"] || "-";
    const creator = truncate(asset.params?.creator || "");
    const rowClass = i % 2 === 1 ? " is-row-alt" : "";
    return `
      <tr class="is-row${rowClass}">
        <td class="is-cell is-mono">${id}</td>
        <td class="is-cell">${name}</td>
        <td class="is-cell">${unitName}</td>
        <td class="is-cell is-mono" title="${asset.params?.creator || ""}">${creator}</td>
        <td class="is-cell"><button class="allo-link" data-url="https://allo.info/asset/${id}" title="View on allo.info">${ALLO_SVG}</button></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="is-table-wrap">
      <table class="is-table">
        <thead>
          <tr class="is-thead-row">
            <th class="is-th">Asset ID</th>
            <th class="is-th">Name</th>
            <th class="is-th">Unit Name</th>
            <th class="is-th">Creator</th>
            <th class="is-th"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderApplicationsTable(results: any[]): string {
  const rows = results.map((appEntry, i) => {
    const id = appEntry.id ?? "-";
    const creator = truncate(appEntry.params?.creator || "");
    const globalStateCount = appEntry.params?.["global-state"]?.length ?? 0;
    const rowClass = i % 2 === 1 ? " is-row-alt" : "";
    return `
      <tr class="is-row${rowClass}">
        <td class="is-cell is-mono">${id}</td>
        <td class="is-cell is-mono" title="${appEntry.params?.creator || ""}">${creator}</td>
        <td class="is-cell is-right">${globalStateCount}</td>
        <td class="is-cell"><button class="allo-link" data-url="https://allo.info/application/${id}" title="View on allo.info">${ALLO_SVG}</button></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="is-table-wrap">
      <table class="is-table">
        <thead>
          <tr class="is-thead-row">
            <th class="is-th">App ID</th>
            <th class="is-th">Creator</th>
            <th class="is-th is-right">Global State</th>
            <th class="is-th"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderTableForType(type: SearchType, results: any[]): string {
  switch (type) {
    case "accounts":
      return renderAccountsTable(results);
    case "transactions":
      return renderTransactionsTable(results);
    case "assets":
      return renderAssetsTable(results);
    case "applications":
      return renderApplicationsTable(results);
    default:
      return `<div class="is-empty">Unknown search type.</div>`;
  }
}

function renderSearchResults(data: IndexerSearchData): string {
  const queryBadges = renderQueryBadges(data.query);

  const typeLabel = data.type.charAt(0).toUpperCase() + data.type.slice(1);

  const bodyHtml = data.results.length > 0
    ? renderTableForType(data.type, data.results)
    : `<div class="is-empty">No ${data.type} found matching the search criteria.</div>`;

  const nextTokenHtml = data.nextToken
    ? `<div class="is-footer">More results available (next-token: ${data.nextToken.slice(0, 12)}...)</div>`
    : "";

  return `
    <div class="is-card">
      <div class="is-header">
        <div class="is-header-label">Search: ${typeLabel}</div>
        <div class="is-header-count">${data.totalResults} result${data.totalResults !== 1 ? "s" : ""} found</div>
        ${queryBadges}
      </div>
      ${bodyHtml}
      ${nextTokenHtml}
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="is-card loading">
      <div class="is-loading-pulse"></div>
      <div class="is-loading-text">Searching the indexer...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="is-card error">
      <div class="is-error-icon">!</div>
      <div class="is-error-text">${message}</div>
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

const app = new App({ name: "indexer-search-widget", version: "1.0.0" });

// Handle allo.info link clicks via host navigation (postMessage to host)
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".allo-link");
  if (btn) {
    const url = btn.dataset.url;
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
  const sc = result.structuredContent as IndexerSearchStructuredContent | undefined;
  if (sc?.indexerSearch) {
    root.innerHTML = renderSearchResults(sc.indexerSearch);
  } else {
    root.innerHTML = renderError("No indexer search results returned.");
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
