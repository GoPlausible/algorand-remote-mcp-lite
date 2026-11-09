/**
 * Indexer Transaction API Tools
 * Direct access to Algorand indexer transaction data
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { ResponseProcessor } from '../../../utils';
import type { Env } from '../../../types';
import { type AssetsBinding, registerWidget } from '../../../ui/widgetManager';

/**
 * Create and validate an Indexer client
 */
function createIndexerClient(indexerUrl: string | undefined): algosdk.Indexer | null {
  if (!indexerUrl) {
    console.error('Algorand indexer URL not configured');
    return null;
  }
  
  return new algosdk.Indexer('', indexerUrl, '');
}

/**
 * Register indexer transaction API tools to the MCP server
 */
export function registerIndexerTransactionTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  // Register transaction history widget
  const txnHistoryResourceUri = 'ui://txn/txn-history.html';
  registerWidget(server, assets, {
    name: 'txn-history-widget',
    htmlPath: '/widgets/txn-history.html',
    resourceUri: txnHistoryResourceUri,
    description: 'Interactive transaction history UI widget',
  });

  // Register transaction detail widget (LORA-style flow diagram)
  const txnDetailResourceUri = 'ui://txn/txn-detail.html';
  registerWidget(server, assets, {
    name: 'txn-detail-widget',
    htmlPath: '/widgets/txn-detail.html',
    resourceUri: txnDetailResourceUri,
    description: 'LORA-style transaction flow diagram UI widget',
  });

  // Normalize indexer transaction data recursively (handles both camelCase and kebab-case)
  function normalizeTxn(t: any): any {
    const pt = t.paymentTransaction ?? t['payment-transaction'];
    const at = t.assetTransferTransaction ?? t['asset-transfer-transaction'];
    const appl = t.applicationTransaction ?? t['application-transaction'];
    const acfg = t.assetConfigTransaction ?? t['asset-config-transaction'];
    const afrz = t.assetFreezeTransaction ?? t['asset-freeze-transaction'];
    const innerRaw = t.innerTxns ?? t['inner-txns'] ?? [];

    // Convert Uint8Array to base64 string (algosdk v3 decodes bytes fields)
    function toBase64(val: any): string | undefined {
      if (!val) return undefined;
      if (val instanceof Uint8Array) {
        const binaryStr = Array.from(val).reduce((acc: string, byte: number) => acc + String.fromCharCode(byte), '');
        return btoa(binaryStr);
      }
      return String(val);
    }

    return {
      id: t.id ?? undefined,
      type: t.txType ?? t['tx-type'] ?? 'unknown',
      sender: t.sender,
      fee: Number(t.fee ?? 0),
      confirmedRound: Number(t.confirmedRound ?? t['confirmed-round'] ?? 0),
      roundTime: Number(t.roundTime ?? t['round-time'] ?? 0),
      group: toBase64(t.group),
      note: toBase64(t.note),
      paymentTransaction: pt ? {
        amount: Number(pt.amount ?? 0),
        receiver: pt.receiver,
        closeRemainderTo: pt.closeRemainderTo ?? pt['close-remainder-to'] ?? undefined,
      } : undefined,
      assetTransferTransaction: at ? {
        assetId: Number(at.assetId ?? at['asset-id'] ?? 0),
        amount: Number(at.amount ?? 0),
        receiver: at.receiver,
        sender: at.sender ?? undefined,
        closeTo: at.closeTo ?? at['close-to'] ?? undefined,
      } : undefined,
      applicationTransaction: appl ? {
        applicationId: Number(appl.applicationId ?? appl['application-id'] ?? 0),
        onCompletion: appl.onCompletion ?? appl['on-completion'] ?? 'noop',
        applicationArgs: (appl.applicationArgs ?? appl['application-args'] ?? []).map((a: any) => toBase64(a) ?? ''),
        foreignApps: (appl.foreignApps ?? appl['foreign-apps'] ?? []).map((id: any) => Number(id)),
        foreignAssets: (appl.foreignAssets ?? appl['foreign-assets'] ?? []).map((id: any) => Number(id)),
      } : undefined,
      assetConfigTransaction: acfg ? {
        assetId: Number(acfg.assetId ?? acfg['asset-id'] ?? 0),
      } : undefined,
      assetFreezeTransaction: afrz ? {
        assetId: Number(afrz.assetId ?? afrz['asset-id'] ?? 0),
        address: afrz.address,
        newFreezeStatus: afrz.newFreezeStatus ?? afrz['new-freeze-status'] ?? false,
      } : undefined,
      innerTxns: innerRaw.map((inner: any) => normalizeTxn(inner)),
      createdApplicationIndex: Number(t.createdApplicationIndex ?? t['created-application-index'] ?? 0) || undefined,
      createdAssetIndex: Number(t.createdAssetIndex ?? t['created-asset-index'] ?? 0) || undefined,
    };
  }

  // Lookup transaction by ID (with LORA-style flow diagram UI)
  registerAppTool(server,
    'indexer_lookup_transaction_by_id',
    {
      description: 'Get transaction details or all transactions in an atomic group from the indexer with flow visualization',
      inputSchema: {
        txid: z.string().optional().describe('Transaction ID (required if groupId not provided)'),
        groupId: z.string().optional().describe('Atomic group ID (base64). Returns all transactions in the group instead of a single transaction.'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: txnDetailResourceUri },
      },
    },
    async ({ txid, groupId, pageToken }) => {

      // Group lookup branch
      if (groupId) {
        if (!env.ALGORAND_INDEXER) {
          return { content: [{ type: 'text' as const, text: 'Algorand indexer URL not configured' }] };
        }
        try {
          const baseUrl = env.ALGORAND_INDEXER.replace(/\/$/, '');
          const headers: Record<string, string> = {};
          if (env.ALGORAND_TOKEN) headers['X-Algo-API-Token'] = env.ALGORAND_TOKEN;
          const resp = await fetch(`${baseUrl}/v2/transactions?group-id=${encodeURIComponent(groupId)}&limit=50`, { headers });
          if (!resp.ok) throw new Error(`Indexer returned ${resp.status}`);
          const data = await resp.json() as { transactions?: any[] };
          const transactions = (data.transactions || []).map(normalizeTxn);
          const totalFee = transactions.reduce((s: number, t: any) => s + t.fee, 0);
          const confirmedRound = transactions[0]?.confirmedRound ?? 0;
          const roundTime = transactions[0]?.roundTime ?? 0;
          const typeCounts: Record<string, number> = {};
          for (const t of transactions) typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ group: groupId.slice(0, 12), transactionCount: transactions.length, confirmedRound }, null, 2) }],
            structuredContent: {
              txnGroup: { groupId, transactions, totalFee, confirmedRound, roundTime, typeCounts },
            },
          };
        } catch (error: any) {
          return { content: [{ type: 'text' as const, text: `Error loading group: ${error.message || 'Unknown error'}` }] };
        }
      }

      // Single-tx lookup (existing code follows)
      if (!txid) {
        return { content: [{ type: 'text' as const, text: 'Either txid or groupId is required' }] };
      }

      if (!env.ALGORAND_INDEXER) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Algorand indexer URL not configured'
          }]
        };
      }

      try {
        // Create indexer client
        const indexerClient = createIndexerClient(env.ALGORAND_INDEXER);
        if (!indexerClient) {
          throw new Error('Failed to create Algorand indexer client');
        }

        // Lookup transaction by ID
        const response = await indexerClient.lookupTransactionByID(String(txid)).do();
        const rawTxn = response.transaction ?? response;
        const transaction = normalizeTxn(rawTxn);

        const textResponse = ResponseProcessor.processResponse(response, pageToken);

        return {
          content: textResponse.content,
          structuredContent: {
            txnDetail: { transaction },
          },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error looking up transaction: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
  
  // Lookup account transactions (with UI)
  registerAppTool(server,
    'indexer_lookup_account_transactions',
    {
      description: 'Get transactions related to an account',
      inputSchema: {
        address: z.string().describe('Account address'),
        limit: z.number().int().optional().describe('Maximum number of transactions to return'),
        txType: z.string().optional().describe('Filter by transaction type'),
        sigType: z.string().optional().describe('Filter by signature type'),
        assetId: z.number().int().optional().describe('Filter by asset ID'),
        beforeTime: z.string().optional().describe('Return transactions before this time (RFC 3339 format)'),
        afterTime: z.string().optional().describe('Return transactions after this time (RFC 3339 format)'),
        currencyGreaterThan: z.number().int().optional().describe('Return transactions with amount greater than this value'),
        currencyLessThan: z.number().int().optional().describe('Return transactions with amount less than this value'),
        round: z.number().int().optional().describe('Return transactions for a specific round'),
        minRound: z.number().int().optional().describe('Return transactions after this round'),
        maxRound: z.number().int().optional().describe('Return transactions before this round'),
        nextToken: z.string().optional().describe('Token for retrieving the next page of results'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: txnHistoryResourceUri },
      },
    },
    async ({ address, limit, txType, sigType, assetId, beforeTime, afterTime,
             currencyGreaterThan, currencyLessThan, round, minRound, maxRound, nextToken, pageToken }) => {
      
      if (!env.ALGORAND_INDEXER) {
        return {
          content: [{
            type: 'text',
            text: 'Algorand indexer URL not configured'
          }]
        };
      }
      
      try {
        // Create indexer client
        const indexerClient = createIndexerClient(env.ALGORAND_INDEXER);
        if (!indexerClient) {
          throw new Error('Failed to create Algorand indexer client');
        }
        
        // Setup lookup with parameters
        let search = indexerClient.lookupAccountTransactions(String(address));
        
        // Default limit to prevent massive responses that timeout on Workers
        search = search.limit(limit ? Number(limit) : 20);
        if (txType) {
          search = search.txType(String(txType));
        }
        if (sigType) {
          search = search.sigType(String(sigType));
        }
        if (assetId) {
          search = search.assetID(Number(assetId));
        }
        if (beforeTime) {
          search = search.beforeTime(String(beforeTime));
        }
        if (afterTime) {
          search = search.afterTime(String(afterTime));
        }
        if (currencyGreaterThan) {
          search = search.currencyGreaterThan(Number(currencyGreaterThan));
        }
        if (currencyLessThan) {
          search = search.currencyLessThan(Number(currencyLessThan));
        }
        if (round) {
          search = search.round(Number(round));
        }
        if (minRound) {
          search = search.minRound(Number(minRound));
        }
        if (maxRound) {
          search = search.maxRound(Number(maxRound));
        }
        if (nextToken) {
          search = search.nextToken(String(nextToken));
        }
        
        // Execute lookup
        const response = await search.do();

        // Build structured content for the widget
        const allTxns = (response.transactions || []).map((t: any) => {
          const pt = t.paymentTransaction ?? t['payment-transaction'];
          const at = t.assetTransferTransaction ?? t['asset-transfer-transaction'];
          const appl = t.applicationTransaction ?? t['application-transaction'];
          return {
            id: t.id,
            type: t.txType ?? t['tx-type'] ?? 'unknown',
            sender: t.sender,
            fee: Number(t.fee),
            confirmedRound: Number(t.confirmedRound ?? t['confirmed-round'] ?? 0),
            roundTime: Number(t.roundTime ?? t['round-time'] ?? 0),
            paymentTransaction: pt ? {
              amount: Number(pt.amount ?? 0),
              receiver: pt.receiver,
              closeRemainderTo: pt.closeRemainderTo ?? pt['close-remainder-to'] ?? undefined,
            } : undefined,
            assetTransferTransaction: at ? {
              assetId: Number(at.assetId ?? at['asset-id'] ?? 0),
              amount: Number(at.amount ?? 0),
              receiver: at.receiver,
              sender: at.sender ?? undefined,
            } : undefined,
            applicationTransaction: appl ? {
              applicationId: Number(appl.applicationId ?? appl['application-id'] ?? 0),
              onCompletion: appl.onCompletion ?? appl['on-completion'] ?? 'noop',
            } : undefined,
            note: t.note ?? undefined,
            group: t.group ?? undefined,
          };
        });

        // Pass indexer's native next-token for real pagination across full transaction history
        const indexerNextToken = (response as any)['next-token'] ?? null;

        const txnHistory = {
          address,
          transactions: allTxns,
          totalTransactions: allTxns.length,
          'next-token': indexerNextToken ? String(indexerNextToken) : null,
        };

        // Build text fallback — use a lightweight summary instead of processing the full raw response
        // which can timeout on Workers due to recursive serialization in processResponse
        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(response, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ address, transactionCount: allTxns.length });
        } catch {
          textContent = JSON.stringify({ address, transactionCount: allTxns.length });
        }
        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { txnHistory },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error looking up account transactions: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Search for transactions
  // server.tool(
  //   'indexer_search_for_transactions',
  //   'Search for transactions with various criteria',
  //   {
  //     limit: z.number().int().optional().describe('Maximum number of transactions to return'),
  //     notePrefix: z.string().optional().describe('Filter by note prefix (base64-encoded)'),
  //     txType: z.string().optional().describe('Filter by transaction type'),
  //     sigType: z.string().optional().describe('Filter by signature type'),
  //     address: z.string().optional().describe('Filter by address'),
  //     addressRole: z.enum(['sender', 'receiver', 'freeze-target']).optional().describe('Role of the address'),
  //     assetId: z.number().int().optional().describe('Filter by asset ID'),
  //     beforeTime: z.string().optional().describe('Return transactions before this time (RFC 3339 format)'),
  //     afterTime: z.string().optional().describe('Return transactions after this time (RFC 3339 format)'),
  //     currencyGreaterThan: z.number().int().optional().describe('Return transactions with amount greater than this value'),
  //     currencyLessThan: z.number().int().optional().describe('Return transactions with amount less than this value'),
  //     round: z.number().int().optional().describe('Return transactions for a specific round'),
  //     minRound: z.number().int().optional().describe('Return transactions after this round'),
  //     maxRound: z.number().int().optional().describe('Return transactions before this round'),
  //     applicationId: z.number().int().optional().describe('Filter by application ID'),
  //     rekeyTo: z.boolean().optional().describe('Filter for transactions that rekey accounts'),
  //     nextToken: z.string().optional().describe('Token for retrieving the next page of results')
  //   },
  //   async ({ limit, notePrefix, txType, sigType, address, addressRole, assetId, beforeTime, afterTime, 
  //            currencyGreaterThan, currencyLessThan, round, minRound, maxRound, 
  //            applicationId, rekeyTo, nextToken }) => {
      
  //     if (!env.ALGORAND_INDEXER) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: 'Algorand indexer URL not configured'
  //         }]
  //       };
  //     }
      
  //     try {
  //       // Create indexer client
  //       const indexerClient = createIndexerClient(env.ALGORAND_INDEXER);
  //       if (!indexerClient) {
  //         throw new Error('Failed to create Algorand indexer client');
  //       }
        
  //       // Setup search with parameters
  //       let search = indexerClient.searchForTransactions();
        
  //       if (limit) {
  //         search = search.limit(Number(limit));
  //       }
  //       if (notePrefix) {
  //         search = search.notePrefix(Buffer.from(notePrefix, 'base64'));
  //       }
  //       if (txType) {
  //         search = search.txType(String(txType));
  //       }
  //       if (sigType) {
  //         search = search.sigType(String(sigType));
  //       }
  //       if (address) {
  //         search = search.address(String(address));
  //       }
  //       if (address && addressRole) {
  //         search = search.addressRole(String(addressRole));
  //       }
  //       if (assetId) {
  //         search = search.assetID(Number(assetId));
  //       }
  //       if (beforeTime) {
  //         search = search.beforeTime(String(beforeTime));
  //       }
  //       if (afterTime) {
  //         search = search.afterTime(String(afterTime));
  //       }
  //       if (currencyGreaterThan) {
  //         search = search.currencyGreaterThan(Number(currencyGreaterThan));
  //       }
  //       if (currencyLessThan) {
  //         search = search.currencyLessThan(Number(currencyLessThan));
  //       }
  //       if (round) {
  //         search = search.round(Number(round));
  //       }
  //       if (minRound) {
  //         search = search.minRound(Number(minRound));
  //       }
  //       if (maxRound) {
  //         search = search.maxRound(Number(maxRound));
  //       }
  //       if (applicationId) {
  //         search = search.applicationID(Number(applicationId));
  //       }
  //       if (rekeyTo === true) {
  //         search = search.rekeyTo(true);
  //       }
  //       if (nextToken) {
  //         search = search.nextToken(String(nextToken));
  //       }
        
  //       // Execute search
  //       const response = await search.do();
        
  //       return ResponseProcessor.processResponse(response);
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error searching transactions: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
}
