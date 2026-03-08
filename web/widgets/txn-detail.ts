import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./txn-detail.css";

// ── Types ──────────────────────────────────────────────────────────────

interface Transaction {
  id?: string;
  type: string;
  sender: string;
  fee: number;
  confirmedRound: number;
  roundTime: number;
  group?: string;
  note?: string;
  paymentTransaction?: {
    amount: number;
    receiver: string;
    closeRemainderTo?: string;
  };
  assetTransferTransaction?: {
    assetId: number;
    amount: number;
    receiver: string;
    sender?: string;
    closeTo?: string;
  };
  applicationTransaction?: {
    applicationId: number;
    onCompletion: string;
    applicationArgs?: string[];
    foreignApps?: number[];
    foreignAssets?: number[];
  };
  assetConfigTransaction?: {
    assetId: number;
    params?: Record<string, unknown>;
  };
  assetFreezeTransaction?: {
    assetId: number;
    address: string;
    newFreezeStatus: boolean;
  };
  innerTxns?: Transaction[];
  createdApplicationIndex?: number;
  createdAssetIndex?: number;
}

interface TxnGroup {
  groupId: string;
  transactions: Transaction[];
  totalFee: number;
  confirmedRound: number;
  roundTime: number;
  typeCounts: Record<string, number>;
}

interface TxnDetailData {
  txnDetail?: { transaction: Transaction };
  txnGroup?: TxnGroup;
}

type EntityKind = "account" | "application";

interface Entity {
  kind: EntityKind;
  value: string;
  index: number;
  label: string;
  url: string;
}

interface FlowRow {
  txn: Transaction;
  depth: number;
  path: string;
  lastAtDepth: boolean[];
  srcIdx: number;
  dstIdx: number;
  label: string;
  detail: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const ALLO = "https://allo.info";

const TYPE_LABELS: Record<string, string> = {
  pay: "Payment",
  axfer: "Asset Transfer",
  appl: "App Call",
  acfg: "Asset Config",
  afrz: "Asset Freeze",
  keyreg: "Key Reg",
};

const TYPE_COLORS: Record<string, string> = {
  pay: "#16a34a",
  axfer: "#0891b2",
  appl: "#7c3aed",
  acfg: "#d97706",
  afrz: "#0ea5e9",
  keyreg: "#6b7280",
};

const ENTITY_COLORS: Record<EntityKind, string> = {
  account: "#0ea5e9",
  application: "#8b5cf6",
};

const ICONS = {
  account:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  application:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  copy: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  extLink:
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
};

// ── Utilities ──────────────────────────────────────────────────────────

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function trunc(s: string, a = 4, b = 4): string {
  if (!s) return "\u2014";
  if (s.length <= a + b + 3) return s;
  return `${s.slice(0, a)}\u2026${s.slice(-b)}`;
}

function fmtAlgo(uAlgo: number): string {
  if (typeof uAlgo !== "number" || Number.isNaN(uAlgo)) return "0";
  return (uAlgo / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function fmtTime(unix: number): string {
  if (!unix) return "\u2014";
  return new Date(unix * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function relTime(unix: number): string {
  if (!unix) return "";
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function decodeNote(b64: string | undefined): string | null {
  if (!b64) return null;
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const text = new TextDecoder("utf-8").decode(bytes);
    return text.trim() || null;
  } catch {
    return null;
  }
}

function ocLabel(oc: string): string {
  switch (oc?.toLowerCase()) {
    case "noop":
      return "App Call";
    case "optin":
      return "App Opt-In";
    case "closeout":
      return "App Close-Out";
    case "clear":
      return "App Clear";
    case "update":
      return "App Update";
    case "delete":
      return "App Delete";
    default:
      return oc || "App Call";
  }
}

function renderDetailText(detail: string): string {
  const parts = detail.split(/(ASA#\d+)/);
  return parts
    .map((p) => {
      const m = p.match(/^ASA#(\d+)$/);
      if (m) {
        return `<button class="td-asa-link" data-url="${ALLO}/asset/${esc(m[1])}">${esc(p)}</button>`;
      }
      return esc(p);
    })
    .join("");
}

// ── Entity Collection ──────────────────────────────────────────────────

function collectEntities(txn: Transaction): Entity[] {
  const seen = new Map<string, Entity>();
  let nextIdx = 1;

  function add(kind: EntityKind, value: string) {
    if (!value) return;
    const key = `${kind}:${value}`;
    if (!seen.has(key)) {
      seen.set(key, {
        kind,
        value,
        index: nextIdx++,
        label: kind === "account" ? trunc(value, 4, 4) : value,
        url:
          kind === "account"
            ? `${ALLO}/account/${value}`
            : `${ALLO}/application/${value}`,
      });
    }
  }

  function walk(t: Transaction) {
    add("account", t.sender);
    if (t.type === "pay" && t.paymentTransaction) {
      add("account", t.paymentTransaction.receiver);
      if (t.paymentTransaction.closeRemainderTo)
        add("account", t.paymentTransaction.closeRemainderTo);
    }
    if (t.type === "axfer" && t.assetTransferTransaction) {
      const at = t.assetTransferTransaction;
      add("account", at.receiver);
      if (at.sender) add("account", at.sender);
      if (at.closeTo) add("account", at.closeTo);
    }
    if (t.type === "appl" && t.applicationTransaction) {
      const appId = t.applicationTransaction.applicationId;
      if (appId && appId > 0) add("application", String(appId));
    }
    if (t.type === "afrz" && t.assetFreezeTransaction) {
      add("account", t.assetFreezeTransaction.address);
    }
    if (t.innerTxns) {
      for (const inner of t.innerTxns) walk(inner);
    }
  }

  walk(txn);
  return Array.from(seen.values());
}

function collectGroupEntities(transactions: Transaction[]): Entity[] {
  const seen = new Map<string, Entity>();
  let nextIdx = 1;

  function add(kind: EntityKind, value: string) {
    if (!value) return;
    const key = `${kind}:${value}`;
    if (!seen.has(key)) {
      seen.set(key, {
        kind,
        value,
        index: nextIdx++,
        label: kind === "account" ? trunc(value, 4, 4) : value,
        url:
          kind === "account"
            ? `${ALLO}/account/${value}`
            : `${ALLO}/application/${value}`,
      });
    }
  }

  function walk(t: Transaction) {
    add("account", t.sender);
    if (t.type === "pay" && t.paymentTransaction) {
      add("account", t.paymentTransaction.receiver);
      if (t.paymentTransaction.closeRemainderTo)
        add("account", t.paymentTransaction.closeRemainderTo);
    }
    if (t.type === "axfer" && t.assetTransferTransaction) {
      const at = t.assetTransferTransaction;
      add("account", at.receiver);
      if (at.sender) add("account", at.sender);
      if (at.closeTo) add("account", at.closeTo);
    }
    if (t.type === "appl" && t.applicationTransaction) {
      const appId = t.applicationTransaction.applicationId;
      if (appId && appId > 0) add("application", String(appId));
    }
    if (t.type === "afrz" && t.assetFreezeTransaction) {
      add("account", t.assetFreezeTransaction.address);
    }
    if (t.innerTxns) {
      for (const inner of t.innerTxns) walk(inner);
    }
  }

  for (const txn of transactions) walk(txn);
  return Array.from(seen.values());
}

// ── Tree Flattening ────────────────────────────────────────────────────

function flattenTree(txn: Transaction, entities: Entity[]): FlowRow[] {
  const entityMap = new Map<string, number>();
  for (const e of entities) entityMap.set(`${e.kind}:${e.value}`, e.index);

  function idx(kind: EntityKind, value: string): number {
    return entityMap.get(`${kind}:${value}`) ?? 0;
  }

  const rows: FlowRow[] = [];

  function walk(
    t: Transaction,
    depth: number,
    path: string,
    lastAtDepth: boolean[]
  ) {
    let srcIdx = idx("account", t.sender);
    let dstIdx = 0;
    let label = TYPE_LABELS[t.type] || t.type || "Unknown";
    let detail = "";

    if (t.type === "pay" && t.paymentTransaction) {
      const p = t.paymentTransaction;
      dstIdx = idx("account", p.receiver);
      label = "Payment";
      detail = `${fmtAlgo(p.amount)} ALGO`;
    } else if (t.type === "axfer" && t.assetTransferTransaction) {
      const at = t.assetTransferTransaction;
      if (at.sender && at.sender !== t.sender) {
        srcIdx = idx("account", at.sender);
        dstIdx = idx("account", at.receiver);
        label = "Clawback";
      } else {
        dstIdx = idx("account", at.receiver);
        label = "Transfer";
      }
      detail = `${at.amount.toLocaleString()} ASA#${at.assetId}`;
    } else if (t.type === "appl" && t.applicationTransaction) {
      const app = t.applicationTransaction;
      if (app.applicationId && app.applicationId > 0) {
        dstIdx = idx("application", String(app.applicationId));
        label = ocLabel(app.onCompletion);
      } else {
        label = "App Create";
      }
    } else if (t.type === "acfg" && t.assetConfigTransaction) {
      label = "Asset Config";
      if (t.assetConfigTransaction.assetId)
        detail = `ASA#${t.assetConfigTransaction.assetId}`;
    } else if (t.type === "afrz" && t.assetFreezeTransaction) {
      const af = t.assetFreezeTransaction;
      dstIdx = idx("account", af.address);
      label = af.newFreezeStatus ? "Freeze" : "Unfreeze";
      detail = `ASA#${af.assetId}`;
    }

    rows.push({
      txn: t,
      depth,
      path,
      lastAtDepth: [...lastAtDepth],
      srcIdx,
      dstIdx,
      label,
      detail,
    });

    if (t.innerTxns) {
      const len = t.innerTxns.length;
      t.innerTxns.forEach((inner, i) => {
        const childPath = path ? `${path}/${i + 1}` : `inner/${i + 1}`;
        walk(inner, depth + 1, childPath, [...lastAtDepth, i === len - 1]);
      });
    }
  }

  walk(txn, 0, "", []);
  return rows;
}

// ── Rendering: Header ──────────────────────────────────────────────────

function renderHeader(txn: Transaction): string {
  const typeLabel = TYPE_LABELS[txn.type] || txn.type || "Unknown";
  const typeColor = TYPE_COLORS[txn.type] || "#64748b";
  const txId = txn.id || "\u2014";
  const roundInfo = txn.confirmedRound
    ? `Round ${txn.confirmedRound.toLocaleString()}`
    : "";
  const timeInfo = fmtTime(txn.roundTime);
  const rel = relTime(txn.roundTime);

  return `
    <header class="td-header">
      <div class="td-header-top">
        <h1 class="td-title">Transaction Detail</h1>
        <span class="td-type-badge" style="background:${typeColor}">${esc(typeLabel)}</span>
      </div>
      <div class="td-txid-row">
        <button class="td-txid" data-url="${ALLO}/tx/${esc(txId)}"
           data-full="${esc(txId)}" title="${esc(txId)}">
          ${esc(trunc(txId, 8, 6))}
          <span class="td-ext-icon">${ICONS.extLink}</span>
        </button>
        <button class="td-copy-btn" type="button" data-copy="${esc(txId)}" aria-label="Copy transaction ID">
          ${ICONS.copy} <span>Copy</span>
        </button>
      </div>
      <div class="td-header-meta">
        ${roundInfo ? `<span class="td-meta-chip">${esc(roundInfo)}</span>` : ""}
        ${timeInfo !== "\u2014" ? `<span class="td-meta-chip">${esc(timeInfo)}</span>` : ""}
        ${rel ? `<span class="td-meta-chip td-meta-rel">${esc(rel)}</span>` : ""}
      </div>
    </header>
  `;
}

// ── Rendering: Participants ────────────────────────────────────────────

function renderParticipants(entities: Entity[]): string {
  if (entities.length === 0) return "";

  const items = entities
    .map((e) => {
      const color = ENTITY_COLORS[e.kind];
      const icon = ICONS[e.kind];
      return `
      <div class="td-entity" data-eidx="${e.index}">
        <div class="td-entity-bubble" style="--ec:${color}">
          <span class="td-entity-icon">${icon}</span>
          <span class="td-entity-idx">${e.index}</span>
        </div>
        <button class="td-entity-label" data-url="${esc(e.url)}"
           data-full="${esc(e.value)}" title="${esc(e.value)}">
          ${esc(e.label)}
          <span class="td-ext-icon">${ICONS.extLink}</span>
        </button>
        ${e.kind === "application" ? '<span class="td-entity-kind">App</span>' : ""}
      </div>
    `;
    })
    .join("");

  return `
    <section class="td-participants">
      <div class="td-section-label">
        <span class="td-section-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </span>
        Participants
      </div>
      <div class="td-entity-row">${items}</div>
    </section>
  `;
}

// ── Rendering: Tree Lines ──────────────────────────────────────────────

function renderTreeLines(depth: number, lastAtDepth: boolean[]): string {
  if (depth === 0) return "";
  let html = "";
  for (let d = 1; d < depth; d++) {
    html += `<span class="td-tree-pipe">${lastAtDepth[d] ? "\u00A0" : "\u2502"}</span>`;
  }
  html += `<span class="td-tree-branch">${lastAtDepth[depth] ? "\u2514" : "\u251C"}</span>`;
  return html;
}

// ── Rendering: Flow Row ────────────────────────────────────────────────

function renderFlowRow(
  row: FlowRow,
  entities: Entity[],
  rowIdx: number
): string {
  const { txn, depth, path, srcIdx, dstIdx, label, detail } = row;
  const typeColor = TYPE_COLORS[txn.type] || "#64748b";
  const txId = txn.id || "";
  const pathLabel = depth === 0 ? (txId ? trunc(txId, 6, 4) : "root") : path;
  const pathTitle = depth === 0 ? txId : path;
  const txLink = txId ? `${ALLO}/tx/${txId}` : "#";

  const entityCount = entities.length;
  const getX = (i: number) => ((i - 0.5) / entityCount) * 100;

  const srcX = srcIdx > 0 ? getX(srcIdx) : 5;
  const hasDst = dstIdx > 0;
  const dstX = hasDst ? getX(dstIdx) : srcX + 100 / entityCount * 0.4;

  const minX = Math.min(srcX, dstX);
  const maxX = Math.max(srcX, dstX);
  const lineWidth = maxX - minX;
  const midX = (minX + maxX) / 2;
  const isReversed = hasDst && dstX < srcX;
  const isSelfTransfer = hasDst && srcIdx === dstIdx;

  const srcEntity = entities.find((e) => e.index === srcIdx);
  const dstEntity = entities.find((e) => e.index === dstIdx);
  const srcColor = srcEntity ? ENTITY_COLORS[srcEntity.kind] : "#64748b";
  const dstColor = dstEntity ? ENTITY_COLORS[dstEntity.kind] : "#64748b";

  const treeHtml = renderTreeLines(depth, row.lastAtDepth);

  const lineHtml =
    lineWidth > 0 && !isSelfTransfer
      ? `<div class="td-flow-line ${isReversed ? "reversed" : ""}" style="left:${minX}%;width:${lineWidth}%"></div>`
      : "";

  const srcDot = `
    <div class="td-flow-dot" data-eidx="${srcIdx}" style="left:${srcX}%;--ec:${srcColor}">
      <span>${srcIdx}</span>
    </div>`;

  let dstDot = "";
  if (hasDst && !isSelfTransfer) {
    dstDot = `
      <div class="td-flow-dot" data-eidx="${dstIdx}" style="left:${dstX}%;--ec:${dstColor}">
        <span>${dstIdx}</span>
      </div>`;
  } else if (!hasDst) {
    dstDot = `
      <div class="td-flow-dot td-flow-dot-empty" style="left:${dstX}%">
        <span>\u25CB</span>
      </div>`;
  }

  const labelHtml = `
    <div class="td-flow-label-wrap" style="left:${isSelfTransfer ? srcX + 5 : midX}%">
      <span class="td-flow-action">${esc(label)}</span>
      ${detail ? `<span class="td-flow-detail">${renderDetailText(detail)}</span>` : ""}
    </div>`;

  return `
    <div class="td-flow-row" style="animation-delay:${rowIdx * 60}ms">
      <div class="td-tree-col">
        <div class="td-tree-lines">${treeHtml}</div>
        <button class="td-path-label" data-url="${esc(txLink)}"
           data-full="${esc(pathTitle)}" title="${esc(pathTitle)}">
          ${esc(pathLabel)}
        </button>
      </div>
      <div class="td-flow-col" style="color:${typeColor}">
        <div class="td-flow-track">
          ${lineHtml}
          ${srcDot}
          ${dstDot}
          ${labelHtml}
        </div>
      </div>
    </div>
  `;
}

// ── Rendering: Flow Diagram ────────────────────────────────────────────

function renderFlowDiagram(rows: FlowRow[], entities: Entity[]): string {
  if (rows.length === 0) return "";

  const maxDepth = Math.max(...rows.map((r) => r.depth));
  const treeW = 90 + maxDepth * 22;

  const guides = entities
    .map(
      (e) =>
        `<div class="td-flow-guide" style="left:${((e.index - 0.5) / entities.length) * 100}%"></div>`
    )
    .join("");

  const flowRows = rows
    .map((r, i) => renderFlowRow(r, entities, i))
    .join("");

  return `
    <section class="td-flow">
      <div class="td-section-label">
        <span class="td-section-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </span>
        Transaction Flow
      </div>
      <div class="td-flow-scroll">
        <div class="td-flow-container" style="--tree-w:${treeW}px">
          <div class="td-flow-guides">${guides}</div>
          <div class="td-flow-rows">${flowRows}</div>
        </div>
      </div>
    </section>
  `;
}

// ── Rendering: Details Footer ──────────────────────────────────────────

function renderDetails(txn: Transaction): string {
  const note = decodeNote(txn.note);

  let rows = `
    <div class="td-detail-row">
      <span class="td-detail-label">Fee</span>
      <span class="td-detail-value">${esc(fmtAlgo(txn.fee))} ALGO</span>
    </div>
    <div class="td-detail-row">
      <span class="td-detail-label">Sender</span>
      <span class="td-detail-value">
        <button class="td-addr" data-url="${ALLO}/account/${esc(txn.sender)}"
           data-full="${esc(txn.sender)}" title="${esc(txn.sender)}">
          ${esc(trunc(txn.sender, 6, 6))} <span class="td-ext-icon">${ICONS.extLink}</span>
        </button>
      </span>
    </div>
  `;

  if (txn.group) {
    rows += `
      <div class="td-detail-row">
        <span class="td-detail-label">Group</span>
        <button class="td-group-btn" data-group="${esc(txn.group)}" title="View atomic group">
          <span class="td-mono" data-full="${esc(txn.group)}">${esc(trunc(txn.group, 8, 6))}</span>
          <span class="td-ext-icon">${ICONS.extLink}</span>
        </button>
      </div>
    `;
  }

  if (txn.note) {
    rows += `
      <div class="td-detail-row">
        <span class="td-detail-label">Note</span>
        <span class="td-detail-value ${note ? "" : "td-mono"}"
              title="${esc(note || txn.note)}">${esc(note || trunc(txn.note, 16, 8))}</span>
      </div>
    `;
  }

  const innerCount = txn.innerTxns?.length;
  if (innerCount) {
    rows += `
      <div class="td-detail-row">
        <span class="td-detail-label">Inner Txns</span>
        <span class="td-detail-value">${innerCount}</span>
      </div>
    `;
  }

  return `
    <section class="td-details">
      <div class="td-section-label">
        <span class="td-section-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
        Details
      </div>
      <div class="td-detail-rows">${rows}</div>
    </section>
  `;
}

// ── Rendering: Group View ───────────────────────────────────────────────

function renderGroupView(group: TxnGroup, backTxnId?: string): string {
  const entities = collectGroupEntities(group.transactions);
  const rows = group.transactions.flatMap((txn) => flattenTree(txn, entities));

  const typeLabels = Object.entries(group.typeCounts)
    .map(
      ([type, count]) =>
        `<span class="td-type-badge td-type-badge-sm" style="background:${TYPE_COLORS[type] || "#64748b"}">${esc(TYPE_LABELS[type] || type)}=${count}</span>`
    )
    .join("");

  const blockHtml = group.confirmedRound
    ? `<button class="td-block-link" data-url="${ALLO}/block/${group.confirmedRound}">${group.confirmedRound.toLocaleString()}</button>`
    : "\u2014";

  return `
    <div class="td-widget">
      <article class="td-card">
        <header class="td-header">
          <div class="td-header-top">
            <h1 class="td-title">Transaction Group</h1>
            ${backTxnId ? `<button class="td-back-btn" data-back="${esc(backTxnId)}">← Back</button>` : ""}
          </div>
          <div class="td-txid-row">
            <span class="td-txid td-mono" data-full="${esc(group.groupId)}" title="${esc(group.groupId)}">
              ${esc(trunc(group.groupId, 8, 6))}
            </span>
            <button class="td-copy-btn" type="button" data-copy="${esc(group.groupId)}" aria-label="Copy group ID">
              ${ICONS.copy} <span>Copy</span>
            </button>
          </div>
          <div class="td-header-meta">
            <span class="td-meta-chip">Block ${blockHtml}</span>
            <span class="td-meta-chip">${group.transactions.length} txn${group.transactions.length !== 1 ? "s" : ""} ${typeLabels}</span>
            ${group.roundTime ? `<span class="td-meta-chip">${esc(fmtTime(group.roundTime))}</span>` : ""}
            ${group.roundTime ? `<span class="td-meta-chip td-meta-rel">${esc(relTime(group.roundTime))}</span>` : ""}
            <span class="td-meta-chip">${esc(fmtAlgo(group.totalFee))} ALGO fee</span>
          </div>
        </header>
        ${renderParticipants(entities)}
        ${renderFlowDiagram(rows, entities)}
      </article>
    </div>
  `;
}

function renderGroupLoading(groupId: string): string {
  return `
    <div class="td-widget">
      <div class="td-card td-loading">
        <div class="td-loading-anim">
          <div class="td-dot d1"></div>
          <div class="td-dot d2"></div>
          <div class="td-dot d3"></div>
        </div>
        <div class="td-loading-text">Loading group ${esc(trunc(groupId, 6, 4))}\u2026</div>
      </div>
    </div>
  `;
}

// ── Rendering: Main / Loading / Error ──────────────────────────────────

function renderWidget(data: TxnDetailData): string {
  const txn = data?.txnDetail?.transaction;
  if (!txn) return renderError("No transaction data returned.");

  const entities = collectEntities(txn);
  const rows = flattenTree(txn, entities);

  return `
    <div class="td-widget">
      <article class="td-card">
        ${renderHeader(txn)}
        ${renderParticipants(entities)}
        ${renderFlowDiagram(rows, entities)}
        ${renderDetails(txn)}
      </article>
    </div>
  `;
}

function renderLoading(txid?: string): string {
  return `
    <div class="td-widget">
      <div class="td-card td-loading">
        <div class="td-loading-anim">
          <div class="td-dot d1"></div>
          <div class="td-dot d2"></div>
          <div class="td-dot d3"></div>
        </div>
        <div class="td-loading-text">Loading transaction${txid ? ` ${trunc(txid, 6, 4)}` : ""}\u2026</div>
      </div>
    </div>
  `;
}

function renderError(msg: string): string {
  return `
    <div class="td-widget">
      <div class="td-card td-error">
        <div class="td-error-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div class="td-error-text">${esc(msg)}</div>
      </div>
    </div>
  `;
}

// ── Interactions ───────────────────────────────────────────────────────

function attachInteractions() {
  // Entity highlight on hover
  root.addEventListener("mouseover", (e) => {
    const el = (e.target as HTMLElement).closest("[data-eidx]");
    if (el) {
      const eidx = el.getAttribute("data-eidx");
      root
        .querySelectorAll(`[data-eidx="${eidx}"]`)
        .forEach((n) => n.classList.add("td-hl"));
    }
  });

  root.addEventListener("mouseout", (e) => {
    const el = (e.target as HTMLElement).closest("[data-eidx]");
    if (el) {
      root.querySelectorAll(".td-hl").forEach((n) => n.classList.remove("td-hl"));
    }
  });

  // Copy buttons
  root.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest(
      "[data-copy]"
    ) as HTMLButtonElement | null;
    if (!btn) return;
    const value = btn.getAttribute("data-copy");
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      const span = btn.querySelector("span");
      if (span) {
        const orig = span.textContent;
        span.textContent = "Copied!";
        setTimeout(() => {
          span.textContent = orig;
        }, 1200);
      }
    } catch {
      /* sandbox */
    }
  });

  // Tooltip for data-full elements
  const tip = document.createElement("div");
  tip.className = "td-tip";
  tip.innerHTML = `<span class="td-tip-text"></span><button class="td-tip-copy" type="button">${ICONS.copy} Copy</button>`;
  document.body.appendChild(tip);

  let hideTimer: number | null = null;

  function showTip(el: Element) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    const full = el.getAttribute("data-full") || "";
    const t = tip.querySelector(".td-tip-text");
    if (t) t.textContent = full;
    const rect = el.getBoundingClientRect();
    tip.style.left = `${rect.left + rect.width / 2}px`;
    tip.style.top = `${rect.bottom + 8}px`;
    tip.classList.add("td-tip-show");
  }

  function scheduleHide() {
    hideTimer = window.setTimeout(() => {
      tip.classList.remove("td-tip-show");
    }, 200);
  }

  root.addEventListener("mouseover", (e) => {
    const el = (e.target as HTMLElement).closest("[data-full]");
    if (el) showTip(el);
  });

  root.addEventListener("mouseout", (e) => {
    const el = (e.target as HTMLElement).closest("[data-full]");
    if (el) scheduleHide();
  });

  tip.addEventListener("mouseenter", () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  tip.addEventListener("mouseleave", () => {
    tip.classList.remove("td-tip-show");
  });

  tip.querySelector(".td-tip-copy")?.addEventListener("click", async () => {
    const text = tip.querySelector(".td-tip-text")?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      const btn = tip.querySelector(".td-tip-copy")!;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.innerHTML = `${ICONS.copy} Copy`;
      }, 1200);
    } catch {
      /* sandbox */
    }
  });
}

// ── Group / Navigation State ────────────────────────────────────────────

let lastTxnId: string | null = null;

async function loadGroup(groupId: string) {
  root.innerHTML = renderGroupLoading(groupId);
  try {
    const result = await app.callServerTool({
      name: "indexer_lookup_transaction_by_id",
      arguments: { groupId },
    });
    const sc = result.structuredContent as TxnDetailData | undefined;
    if (sc?.txnGroup) {
      root.innerHTML = renderGroupView(sc.txnGroup, lastTxnId ?? undefined);
      attachInteractions();
    } else {
      root.innerHTML = renderError("No group data returned.");
    }
  } catch (err) {
    console.error("Failed to load group:", err);
    root.innerHTML = renderError("Failed to load group.");
  }
}

async function loadTxn(txid: string) {
  root.innerHTML = renderLoading(txid);
  try {
    const result = await app.callServerTool({
      name: "indexer_lookup_transaction_by_id",
      arguments: { txid },
    });
    const sc = result.structuredContent as TxnDetailData | undefined;
    if (sc?.txnDetail?.transaction) {
      root.innerHTML = renderWidget(sc as { txnDetail: { transaction: Transaction } });
      attachInteractions();
    } else {
      root.innerHTML = renderError("No transaction data returned.");
    }
  } catch (err) {
    console.error("Failed to load transaction:", err);
    root.innerHTML = renderError("Failed to load transaction.");
  }
}

// ── App Lifecycle ──────────────────────────────────────────────────────

const root = document.getElementById("root")!;
root.innerHTML = renderLoading();

function handleCtx(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    const { top, right, bottom, left } = ctx.safeAreaInsets;
    root.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }
}

const app = new App({ name: "txn-detail-widget", version: "1.0.0" });

// Handle external link clicks via host navigation (postMessage to host)
document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-url]");
  if (el) {
    const url = el.dataset.url;
    if (url) app.openLink({ url });
  }
});

// Handle group-view and back-navigation clicks
document.addEventListener("click", (e) => {
  const groupBtn = (e.target as HTMLElement).closest<HTMLElement>(".td-group-btn");
  if (groupBtn) {
    const groupId = groupBtn.dataset.group;
    if (groupId) loadGroup(groupId);
    return;
  }
  const backBtn = (e.target as HTMLElement).closest<HTMLElement>(".td-back-btn");
  if (backBtn) {
    const txid = backBtn.dataset.back;
    if (txid) loadTxn(txid);
  }
});

app.ontoolinput = (params) => {
  const args = params.arguments as Record<string, unknown> | undefined;
  const txid = (args?.txid ?? args?.transactionId ?? args?.id) as
    | string
    | undefined;
  root.innerHTML = renderLoading(txid);
};

app.ontoolinputpartial = (params) => {
  const args = params.arguments as Record<string, unknown> | undefined;
  const txid = (args?.txid ?? args?.transactionId ?? args?.id) as
    | string
    | undefined;
  if (txid) root.innerHTML = renderLoading(txid);
};

app.ontoolresult = (result: CallToolResult) => {
  const sc = result.structuredContent as TxnDetailData | undefined;
  if (sc?.txnDetail?.transaction) {
    lastTxnId = sc.txnDetail.transaction.id ?? null;
    root.innerHTML = renderWidget(sc as { txnDetail: { transaction: Transaction } });
    attachInteractions();
  } else if (sc?.txnGroup) {
    root.innerHTML = renderGroupView(sc.txnGroup, lastTxnId ?? undefined);
    attachInteractions();
  } else {
    root.innerHTML = renderError("No transaction data returned.");
  }
};

app.ontoolcancelled = () => {
  root.innerHTML = renderError("Request was cancelled.");
};

app.onerror = () => {
  root.innerHTML = renderError("An error occurred.");
};

app.onhostcontextchanged = handleCtx;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleCtx(ctx);
});
