import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./chain-weather.css";

const ALLO_SVG = `<svg width="14" height="14" viewBox="0 0 865 503" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M461.7 389.6c5.7 0 10.2-4.6 10.2-10.2V124.6c0-5.9-5-10.6-10.9-10.2l-36.8 2.6c-5.4.4-9.5 4.8-9.5 10.2v252.2c0 5.6 4.6 10.2 10.2 10.2h36.8z" fill="#4F40AA"/><path d="M386.1 379.4c0 5.6-4.6 10.2-10.2 10.2h-36.8c-5.6 0-10.2-4.6-10.2-10.2V163.9c0-5.4 4.2-9.8 9.5-10.2l36.8-2.6c5.9-.4 10.9 4.3 10.9 10.2v218z" fill="#4F40AA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M183.8 264.1c-5.7 2-12.3-.7-14.3-6.4l-8.4-23.8c-1.7-4.7.2-10 4.8-11.9 3.7-1.6 7.9-3.1 12.4-4.4 8.1-2.4 16.6-4.3 25.5-5.7 9.1-1.4 17.2-2.1 24.4-2.1 14.9 0 27.8 2.8 38.8 8.5 11.3 5.7 19.9 13.6 25.9 23.8 6.2 10.2 9.3 22 9.3 35.5v99.6c0 5.6-4.6 10.2-10.2 10.2h-15.9c-3.3 0-6.3-1.6-8.3-4.2l-2.7-3.6c-3.9-5.3-11.6-5.6-16.6-1.3-3.4 2.8-7 5.3-10.7 7.4-7.2 4-14.9 6-23 6-21.6 0-37.6-5.3-48.2-16s-15.8-24.6-15.8-41.9c0-18.2 6.2-31.5 18.7-39.8s30.1-12.8 50-12.8h26.3c.5 0 .9-.5.7-1-.2-.5-.2-.6-.2-.6-.7-7.3-3.4-12.8-7.9-16.6-4.3-4-10-6-16.9-6-7.2 0-15.2 1.1-24.1 3.2-4.5 1.1-8.6 2.3-12.5 3.6zm20 56.1c-3.6 3.8-5.4 8.2-5.4 13.2 0 2.8.7 5.4 2.2 7.8 1.7 2.4 3.7 4.3 6.1 5.7 2.6 1.4 5.5 2.1 8.7 2.1 5 0 10.2-1.1 15.5-3.2 4-1.8 7.8-4.1 11.6-7 2.3-1.8 3.5-4.6 3.5-7.5v-6.5c0-5.6-4.6-10.2-10.2-10.2h-17.1c-6.2 0-11.1 1.9-14.7 5.7z" fill="#4F40AA"/><path d="M535.3 381.2c14.1 6.8 30.4 10.3 48.9 10.3 18.3 0 34.5-3.6 48.6-10.6 14.3-7.1 25.6-17.4 33.8-30.9 8.2-13.5 12.3-29.6 12.3-48.3 0-19.6-4-36.2-12-49.7-8-13.7-19-24.1-33.1-31.2-14.1-7.1-30.4-10.6-48.9-10.6-18.1 0-34.3 3.7-48.6 11-14.1 7.3-25.2 17.7-33.4 31.2-8 13.5-12.1 29.8-12.3 49 0 19.2 3.9 35.6 11.6 49.4 8 13.5 19 23.7 33.1 30.5zm69-40.8c-5.4 3.5-12 5.3-19.7 5.3-7.5 0-14.1-1.9-19.7-5.7-5.4-3.8-9.6-9-12.7-15.6-3-6.9-4.6-14.5-4.6-23 0-9.2 1.5-17.2 4.6-23.8 3-6.6 7.4-11.8 13-15.6 5.9-3.8 12.6-5.7 20.1-5.7s12.6 2 18 6c5.6 3.8 9.9 9.1 12.7 16 3 6.9 4.6 14.7 4.6 23.5 0 8.7-1.5 16.4-4.6 23-3 6.6-7.4 11.8-13 15.6z" fill="#4F40AA"/></svg>`;

interface ChainWeatherData {
  condition: "sunny" | "partly-cloudy" | "cloudy" | "rainy" | "stormy";
  conditionLabel: string;
  conditionDescription: string;
  metrics: {
    avgTps: number;
    q90Tps: number;
    peakTps: number;
    avgBlockTime: number;
    avgTxnPerBlock: number;
    maxBlockTxn: number;
  };
  txnVolume: {
    hours: number;
    totalTxns: number;
    outerTxns: number;
    innerTxns: number;
    groupTxns: number;
    newAccounts: number;
    totalFees: number;
  };
  ledger: {
    totalSupply: number;
    onlineStake: number;
    onlinePercent: number;
    currentRound: number;
  };
  participation: {
    onlineAccounts: number;
    onlineVotingAlgo: number;
    voters7d: number;
    proposers7d: number;
    averageStake: number;
    medianStake: number;
    largestStake: number;
    largestStakeAddr: string;
    q25Stake: number;
    q75Stake: number;
    q95Stake: number;
  } | null;
  accounts: {
    openAccounts: number;
    totalAccounts: number;
    totalAddresses: number;
    smartContracts: number;
    mbrLocked: number;
    mbrInNonSCs: number;
    mbrInSCs: number;
    balanceInSCs: number;
  } | null;
  txnTrend: number[];
}

interface ChainWeatherStructuredContent {
  chainWeather: ChainWeatherData;
}

function formatNumber(n: number, decimals = 0): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function formatAlgo(microAlgos: number): string {
  return formatNumber(microAlgos / 1_000_000);
}

function getWeatherSvg(condition: string): string {
  switch (condition) {
    case "sunny":
      return `<svg class="weather-icon weather-sunny" viewBox="0 0 120 120">
        <circle class="sun-core" cx="60" cy="60" r="22" fill="#fbbf24"/>
        <circle class="sun-glow" cx="60" cy="60" r="30" fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.3"/>
        <g class="sun-rays">
          <line x1="60" y1="18" x2="60" y2="28" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="60" y1="92" x2="60" y2="102" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="18" y1="60" x2="28" y2="60" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="92" y1="60" x2="102" y2="60" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="30" y1="30" x2="37" y2="37" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="83" y1="83" x2="90" y2="90" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="30" y1="90" x2="37" y2="83" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="83" y1="37" x2="90" y2="30" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
        </g>
      </svg>`;
    case "partly-cloudy":
      return `<svg class="weather-icon weather-partly-cloudy" viewBox="0 0 120 120">
        <circle class="sun-core" cx="45" cy="40" r="18" fill="#fbbf24"/>
        <g class="sun-rays-small">
          <line x1="45" y1="12" x2="45" y2="20" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="19" y1="40" x2="27" y2="40" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="27" y1="22" x2="32" y2="27" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="27" y1="58" x2="32" y2="53" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
        </g>
        <path class="cloud cloud-main" d="M40,80 Q40,62 55,62 Q58,50 72,50 Q88,50 90,65 Q105,65 105,80 Q105,92 92,92 L48,92 Q40,92 40,80 Z" fill="#94a3b8"/>
      </svg>`;
    case "cloudy":
      return `<svg class="weather-icon weather-cloudy" viewBox="0 0 120 120">
        <path class="cloud cloud-back" d="M25,72 Q25,55 40,55 Q43,44 56,44 Q70,44 73,58 Q86,58 86,72 Q86,82 74,82 L34,82 Q25,82 25,72 Z" fill="#94a3b8" opacity="0.5"/>
        <path class="cloud cloud-main" d="M38,88 Q38,70 53,70 Q56,58 70,58 Q86,58 88,73 Q103,73 103,88 Q103,100 90,100 L46,100 Q38,100 38,88 Z" fill="#94a3b8"/>
      </svg>`;
    case "rainy":
      return `<svg class="weather-icon weather-rainy" viewBox="0 0 120 120">
        <path class="cloud cloud-main" d="M30,60 Q30,42 45,42 Q48,30 62,30 Q78,30 80,45 Q95,45 95,60 Q95,72 82,72 L38,72 Q30,72 30,60 Z" fill="#64748b"/>
        <line class="rain-drop rain-1" x1="45" y1="78" x2="40" y2="95" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
        <line class="rain-drop rain-2" x1="58" y1="78" x2="53" y2="95" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
        <line class="rain-drop rain-3" x1="71" y1="78" x2="66" y2="95" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
        <line class="rain-drop rain-4" x1="84" y1="78" x2="79" y2="95" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
        <line class="rain-drop rain-5" x1="51" y1="88" x2="46" y2="105" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        <line class="rain-drop rain-6" x1="64" y1="88" x2="59" y2="105" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      </svg>`;
    case "stormy":
      return `<svg class="weather-icon weather-stormy" viewBox="0 0 120 120">
        <path class="cloud cloud-main" d="M25,55 Q25,37 40,37 Q43,25 57,25 Q73,25 75,40 Q90,40 90,55 Q90,67 77,67 L33,67 Q25,67 25,55 Z" fill="#475569"/>
        <polygon class="lightning" points="62,65 50,85 58,85 48,108 72,78 62,78 70,65" fill="#fbbf24"/>
        <line class="rain-drop rain-1" x1="35" y1="72" x2="30" y2="88" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
        <line class="rain-drop rain-2" x1="45" y1="72" x2="40" y2="88" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
        <line class="rain-drop rain-3" x1="78" y1="72" x2="73" y2="88" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
        <line class="rain-drop rain-4" x1="88" y1="72" x2="83" y2="88" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    default:
      return `<svg class="weather-icon" viewBox="0 0 120 120"><circle cx="60" cy="60" r="22" fill="#fbbf24"/></svg>`;
  }
}

function getConditionGradient(condition: string): string {
  switch (condition) {
    case "sunny": return "linear-gradient(135deg, #fbbf24, #f59e0b, #f97316)";
    case "partly-cloudy": return "linear-gradient(135deg, #60a5fa, #38bdf8, #fbbf24)";
    case "cloudy": return "linear-gradient(135deg, #94a3b8, #64748b, #475569)";
    case "rainy": return "linear-gradient(135deg, #3b82f6, #6366f1, #475569)";
    case "stormy": return "linear-gradient(135deg, #1e293b, #475569, #6366f1)";
    default: return "linear-gradient(135deg, #60a5fa, #38bdf8)";
  }
}

function renderSparkline(values: number[]): string {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const barWidth = 100 / values.length;
  const bars = values.map((v, i) => {
    const height = Math.max(4, (v / max) * 100);
    const opacity = 0.4 + (i / values.length) * 0.6;
    return `<rect x="${i * barWidth}%" y="${100 - height}%" width="${Math.max(barWidth - 1, 2)}%" height="${height}%" rx="1" fill="currentColor" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
  return `<svg class="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none">${bars}</svg>`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function renderWeatherCard(data: ChainWeatherData): string {
  const gradient = getConditionGradient(data.condition);
  const sparkline = renderSparkline(data.txnTrend);
  const m = data.metrics;
  const vol = data.txnVolume;

  const onlinePercent = data.ledger.onlinePercent;
  const stakeBarColor = onlinePercent > 60 ? "#22c55e" : onlinePercent > 40 ? "#eab308" : "#ef4444";

  // Participation section
  const partHtml = data.participation ? `
      <div class="cw-section">
        <div class="cw-section-title">Consensus Participation</div>
        <div class="cw-detail-grid">
          <div class="cw-detail-item">
            <span class="cw-detail-label">Online Accounts</span>
            <span class="cw-detail-value">${formatNumber(data.participation.onlineAccounts)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Voters (7d)</span>
            <span class="cw-detail-value">${formatNumber(data.participation.voters7d)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Proposers (7d)</span>
            <span class="cw-detail-value">${formatNumber(data.participation.proposers7d)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Avg Stake</span>
            <span class="cw-detail-value">${formatNumber(data.participation.averageStake)} ALGO</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Median Stake</span>
            <span class="cw-detail-value">${formatNumber(data.participation.medianStake)} ALGO</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Largest Stake</span>
            <span class="cw-detail-value">${formatNumber(data.participation.largestStake)} ALGO</span>
          </div>
        </div>
      </div>` : "";

  // Accounts / MBR section
  const accHtml = data.accounts ? `
      <div class="cw-section">
        <div class="cw-section-title">Network Accounts</div>
        <div class="cw-detail-grid">
          <div class="cw-detail-item">
            <span class="cw-detail-label">Open Accounts</span>
            <span class="cw-detail-value">${formatNumber(data.accounts.openAccounts)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Total Accounts</span>
            <span class="cw-detail-value">${formatNumber(data.accounts.totalAccounts)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Smart Contracts</span>
            <span class="cw-detail-value">${formatNumber(data.accounts.smartContracts)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">MBR Locked</span>
            <span class="cw-detail-value">${formatAlgo(data.accounts.mbrLocked)} ALGO</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Balance in SCs</span>
            <span class="cw-detail-value">${formatAlgo(data.accounts.balanceInSCs)} ALGO</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Addresses</span>
            <span class="cw-detail-value">${formatNumber(data.accounts.totalAddresses)}</span>
          </div>
        </div>
      </div>` : "";

  return `
    <div class="cw-card">
      <div class="cw-hero" style="background: ${gradient}">
        <div class="cw-hero-content">
          <div class="cw-weather-graphic">
            ${getWeatherSvg(data.condition)}
          </div>
          <div class="cw-hero-info">
            <div class="cw-condition-label">${data.conditionLabel}</div>
            <div class="cw-condition-desc">${data.conditionDescription}</div>
            <div class="cw-temp">
              <span class="cw-temp-value">${m.avgTps.toFixed(1)}</span>
              <span class="cw-temp-unit">TPS</span>
            </div>
          </div>
        </div>
      </div>

      <div class="cw-metrics">
        <div class="cw-metric">
          <div class="cw-metric-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
          </div>
          <div class="cw-metric-body">
            <div class="cw-metric-label">Avg TPS</div>
            <div class="cw-metric-value">${m.avgTps.toFixed(1)}</div>
          </div>
        </div>
        <div class="cw-metric">
          <div class="cw-metric-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="cw-metric-body">
            <div class="cw-metric-label">Peak TPS</div>
            <div class="cw-metric-value">${m.peakTps.toFixed(0)}</div>
          </div>
        </div>
        <div class="cw-metric">
          <div class="cw-metric-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>
          </div>
          <div class="cw-metric-body">
            <div class="cw-metric-label">Block Time</div>
            <div class="cw-metric-value">${m.avgBlockTime.toFixed(2)}s</div>
          </div>
        </div>
        <div class="cw-metric">
          <div class="cw-metric-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
          </div>
          <div class="cw-metric-body">
            <div class="cw-metric-label">Participation</div>
            <div class="cw-metric-value">${onlinePercent.toFixed(1)}%</div>
          </div>
        </div>
        <div class="cw-metric">
          <div class="cw-metric-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <div class="cw-metric-body">
            <div class="cw-metric-label">Q90 TPS</div>
            <div class="cw-metric-value">${m.q90Tps.toFixed(1)}</div>
          </div>
        </div>
        <div class="cw-metric">
          <div class="cw-metric-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <div class="cw-metric-body">
            <div class="cw-metric-label">Txn/Block</div>
            <div class="cw-metric-value">${m.avgTxnPerBlock.toFixed(0)}</div>
          </div>
        </div>
      </div>

      <div class="cw-section">
        <div class="cw-section-title">TPS Trend (${vol.hours}h)</div>
        <div class="cw-sparkline-container">
          ${sparkline}
        </div>
      </div>

      <div class="cw-section">
        <div class="cw-section-title">Transaction Volume (${vol.hours}h)</div>
        <div class="cw-detail-grid">
          <div class="cw-detail-item">
            <span class="cw-detail-label">Total Txns</span>
            <span class="cw-detail-value">${formatNumber(vol.totalTxns)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Outer Txns</span>
            <span class="cw-detail-value">${formatNumber(vol.outerTxns)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Inner Txns</span>
            <span class="cw-detail-value">${formatNumber(vol.innerTxns)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Group Txns</span>
            <span class="cw-detail-value">${formatNumber(vol.groupTxns)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">New Accounts</span>
            <span class="cw-detail-value">${formatNumber(vol.newAccounts)}</span>
          </div>
          <div class="cw-detail-item">
            <span class="cw-detail-label">Total Fees</span>
            <span class="cw-detail-value">${vol.totalFees.toFixed(1)} ALGO</span>
          </div>
        </div>
      </div>

      <div class="cw-section">
        <div class="cw-section-title">Network Stake</div>
        <div class="cw-stake-bar-container">
          <div class="cw-stake-bar">
            <div class="cw-stake-fill" style="width: ${Math.min(onlinePercent, 100)}%; background: ${stakeBarColor}"></div>
          </div>
          <div class="cw-stake-labels">
            <span>Online: ${formatAlgo(data.ledger.onlineStake)} ALGO</span>
            <span>${onlinePercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      ${partHtml}
      ${accHtml}

      <div class="cw-supply-grid">
        <div class="cw-supply-item">
          <div class="cw-supply-label">Total Supply</div>
          <div class="cw-supply-value">${formatAlgo(data.ledger.totalSupply)} ALGO</div>
        </div>
        <div class="cw-supply-item">
          <div class="cw-supply-label">Current Round</div>
          <div class="cw-supply-value">${formatNumber(data.ledger.currentRound)}</div>
        </div>
      </div>

      <div class="cw-footer">
        <span class="cw-footer-label">Algorand Chain Weather</span>
        <span class="cw-footer-round">Round #${data.ledger.currentRound.toLocaleString()}</span>
      </div>
      <button class="cw-powered-by" data-url="https://allo.info">
        ${ALLO_SVG}
        <span>Data and stats powered by Allo.info</span>
      </button>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="cw-card loading">
      <div class="cw-loading-weather">
        <svg class="weather-icon weather-sunny" viewBox="0 0 120 120">
          <circle class="sun-core" cx="60" cy="60" r="22" fill="#fbbf24"/>
          <g class="sun-rays">
            <line x1="60" y1="18" x2="60" y2="28" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
            <line x1="60" y1="92" x2="60" y2="102" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
            <line x1="18" y1="60" x2="28" y2="60" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
            <line x1="92" y1="60" x2="102" y2="60" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
      <div class="loading-text">Checking chain conditions...</div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="cw-card error">
      <div class="error-icon">!</div>
      <div class="error-text">${message}</div>
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

const app = new App({ name: "chain-weather-widget", version: "1.0.0" });

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
  const sc = result.structuredContent as ChainWeatherStructuredContent | undefined;
  if (sc?.chainWeather) {
    root.innerHTML = renderWeatherCard(sc.chainWeather);
  } else {
    root.innerHTML = renderError("No chain weather data available.");
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
