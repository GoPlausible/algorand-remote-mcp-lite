/**
 * Algod Stats API Tools
 * Chain weather / metrics dashboard
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResponseProcessor } from '../../../utils';
import type { Env } from '../../../types';
import { type AssetsBinding, registerWidget } from '../../../ui/widgetManager';

/**
 * Compute chain weather condition from metrics
 */
function computeWeather(avgTps: number, _peakTps: number, participationRate: number): {
  condition: string;
  conditionLabel: string;
  conditionDescription: string;
} {
  // Weather is a blend of TPS load and participation health
  // Higher TPS + lower participation = worse weather
  const tpsScore = avgTps < 20 ? 0 : avgTps < 50 ? 1 : avgTps < 100 ? 2 : avgTps < 200 ? 3 : 4;
  const partScore = participationRate > 65 ? 0 : participationRate > 50 ? 1 : participationRate > 35 ? 2 : participationRate > 20 ? 3 : 4;
  const weatherScore = Math.max(tpsScore, partScore);

  switch (weatherScore) {
    case 0:
      return {
        condition: 'sunny',
        conditionLabel: 'Clear Skies',
        conditionDescription: 'Chain is calm and healthy. Low transaction volume with strong consensus participation.',
      };
    case 1:
      return {
        condition: 'partly-cloudy',
        conditionLabel: 'Partly Cloudy',
        conditionDescription: 'Moderate activity on chain. Network is performing well with steady throughput.',
      };
    case 2:
      return {
        condition: 'cloudy',
        conditionLabel: 'Overcast',
        conditionDescription: 'Higher than usual activity. The network is handling increased load.',
      };
    case 3:
      return {
        condition: 'rainy',
        conditionLabel: 'Rain Showers',
        conditionDescription: 'Heavy transaction volume or declining participation. Monitor conditions.',
      };
    default:
      return {
        condition: 'stormy',
        conditionLabel: 'Thunderstorm',
        conditionDescription: 'Very high congestion or significantly reduced participation. Chain under stress.',
      };
  }
}

/**
 * Register Stats API tools to the MCP server
 */
export function registerStatsTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  const weatherResourceUri = 'ui://stats/chain-weather.html';
  registerWidget(server, assets, {
    name: 'chain-weather-widget',
    htmlPath: '/widgets/chain-weather.html',
    resourceUri: weatherResourceUri,
    description: 'Animated chain weather dashboard showing Algorand network conditions',
    connectDomains: ['https://analytics-api.allo.info'],
  });

  server.registerTool(
    'api_get_algorand_weather',
    {
      description: 'Get Algorand chain weather - stats, metrics, health, consensus, and node status as a weather-themed dashboard',
      inputSchema: {},
      _meta: {
        ui: { resourceUri: weatherResourceUri },
        'ui/resourceUri': weatherResourceUri,
      },
    },
    async () => {
      if (!env.ALGORAND_ALGOD) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Algorand node URL not configured'
          }]
        };
      }

      try {
        // Fetch all data sources in parallel
        const headers = {
          'Accept': 'application/json',
          'X-Algo-Api-Token': env.ALGORAND_TOKEN || '',
          'User-Agent': 'GoPlausible AI Agent on X dedicated MCP for Algorand blockchain'
        };

        const [resLedger, resMbr, resTxn, resPart] = await Promise.all([
          fetch(`${env.ALGORAND_ALGOD}/v2/ledger/supply`, { headers }),
          fetch('https://analytics-api.allo.info/v1/stats/account/mbr', { headers }),
          fetch('https://analytics-api.allo.info/v1/charts/blocks/tx/stats/30/60', { headers }),
          fetch('https://analytics-api.allo.info/v1/stats/participation', { headers }),
        ]);

        // Parse NDJSON: read as text, split by newlines, parse first valid JSON line
        function parseNdjson(text: string): any {
          const lines = text.trim().split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try { return JSON.parse(trimmed); } catch { /* skip invalid line */ }
          }
          return null;
        }

        const ledgerSupply: any = resLedger.ok ? await resLedger.json() : null;
        // MBR and participation are NDJSON format
        const mbrText = resMbr.ok ? await resMbr.text() : '';
        const partText = resPart.ok ? await resPart.text() : '';
        const balancesStats: any = parseNdjson(mbrText);
        const participationStats: any = parseNdjson(partText);

        // Txn stats are columnar {meta, data} format
        const txnStatsRaw: any = resTxn.ok ? await resTxn.json() : null;
        const txnMeta: any[] = txnStatsRaw?.meta || [];
        const txnData: any[][] = txnStatsRaw?.data || [];
        const colNames = txnMeta.map((m: any) => m.name);

        // Map columnar data to named objects
        const txnRows = txnData.map((row: any[]) => {
          const obj: Record<string, any> = {};
          colNames.forEach((name: string, i: number) => {
            obj[name] = row[i];
          });
          return obj;
        });

        // Extract pre-computed TPS values from the data
        const tpsValues = txnRows.map((d) => Number(d.tps ?? 0));
        const q90TpsValues = txnRows.map((d) => Number(d.q90Tps ?? 0));
        const peakTpsValues = txnRows.map((d) => Number(d.peakTps ?? 0));

        const avgTps = tpsValues.length > 0
          ? tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length
          : 0;
        const avgQ90Tps = q90TpsValues.length > 0
          ? q90TpsValues.reduce((a, b) => a + b, 0) / q90TpsValues.length
          : 0;
        const peakTps = peakTpsValues.length > 0 ? Math.max(...peakTpsValues) : 0;

        // Average block time from the data
        const blockTimes = txnRows.map((d) => Number(d.avgBlockTime ?? 3.3));
        const avgBlockTime = blockTimes.length > 0
          ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length
          : 3.3;

        // Aggregate transaction volumes across all hourly rows
        const totalAllTxn = txnRows.reduce((sum, d) => sum + Number(d.allTxn ?? 0), 0);
        const totalOuterTxn = txnRows.reduce((sum, d) => sum + Number(d.outerTxn ?? 0), 0);
        const totalInnerTxn = txnRows.reduce((sum, d) => sum + Number(d.innerTxn ?? 0), 0);
        const totalNewAcc = txnRows.reduce((sum, d) => sum + Number(d.newAcc ?? 0), 0);
        const totalGroupTxn = txnRows.reduce((sum, d) => sum + Number(d.groupTxn ?? 0), 0);
        const totalFees = txnRows.reduce((sum, d) => sum + Number(d.fees ?? 0), 0);
        const maxBlockTxn = txnRows.reduce((max, d) => Math.max(max, Number(d.maxBlock ?? 0)), 0);
        const avgTxnPerBlock = txnRows.length > 0
          ? txnRows.reduce((sum, d) => sum + Number(d.avgTxnBlock ?? 0), 0) / txnRows.length
          : 0;

        // Participation rate from ledger supply
        const totalSupply = Number(ledgerSupply?.['total-money'] ?? ledgerSupply?.totalMoney ?? 0);
        const onlineStake = Number(ledgerSupply?.['online-money'] ?? ledgerSupply?.onlineMoney ?? 0);
        const participationRate = totalSupply > 0 ? (onlineStake / totalSupply) * 100 : 0;
        const currentRound = Number(ledgerSupply?.current_round ?? ledgerSupply?.currentRound ?? 0);

        // Compute weather condition
        const weather = computeWeather(avgTps, peakTps, participationRate);

        // Build sparkline trend (last N TPS values)
        const txnTrend = tpsValues.slice(-24);

        const chainWeather = {
          condition: weather.condition,
          conditionLabel: weather.conditionLabel,
          conditionDescription: weather.conditionDescription,
          metrics: {
            avgTps,
            q90Tps: avgQ90Tps,
            peakTps,
            avgBlockTime,
            avgTxnPerBlock,
            maxBlockTxn,
          },
          txnVolume: {
            hours: txnRows.length,
            totalTxns: totalAllTxn,
            outerTxns: totalOuterTxn,
            innerTxns: totalInnerTxn,
            groupTxns: totalGroupTxn,
            newAccounts: totalNewAcc,
            totalFees,
          },
          ledger: {
            totalSupply,
            onlineStake,
            onlinePercent: participationRate,
            currentRound,
          },
          participation: participationStats ? {
            onlineAccounts: Number(participationStats.onlineAccounts ?? 0),
            onlineVotingAlgo: Number(participationStats.onlineVotingAlgo ?? 0),
            voters7d: Number(participationStats.voters7d ?? 0),
            proposers7d: Number(participationStats.proposers7d ?? 0),
            averageStake: Number(participationStats.averageAStake ?? 0),
            medianStake: Number(participationStats.q50 ?? 0),
            largestStake: Number(participationStats.largestAStake ?? 0),
            largestStakeAddr: participationStats.largestAStakeAddr ?? '',
            q25Stake: Number(participationStats.q25 ?? 0),
            q75Stake: Number(participationStats.q75 ?? 0),
            q95Stake: Number(participationStats.q95 ?? 0),
          } : null,
          accounts: balancesStats ? {
            openAccounts: Number(balancesStats.CntAccountsOpen ?? 0),
            totalAccounts: Number(balancesStats.CntAccounts ?? 0),
            totalAddresses: Number(balancesStats.CntAddresses ?? 0),
            smartContracts: Number(balancesStats.CntSCsWithBalance ?? 0),
            mbrLocked: Number(balancesStats.MBRSum ?? 0),
            mbrInNonSCs: Number(balancesStats.MBRInNonSCsSum ?? 0),
            mbrInSCs: Number(balancesStats.MBRInSCsSum ?? 0),
            balanceInSCs: Number(balancesStats.BalanceInSCsSum ?? 0),
          } : null,
          txnTrend,
        };

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse({
            stats: { balancesStats, txnRows, participationStats, ledger: ledgerSupply },
          });
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ condition: chainWeather.condition });
        } catch {
          textContent = JSON.stringify({ condition: chainWeather.condition });
        }

        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textContent) }],
          structuredContent: { structuredData: true, chainWeather },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error getting chain stats: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
