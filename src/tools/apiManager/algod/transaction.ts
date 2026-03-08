/**
 * Algod Transaction API Tools
 * Direct access to Algorand node transaction data
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResponseProcessor } from '../../../utils';
import type { Env } from '../../../types';
import { type AssetsBinding, registerWidget } from '../../../ui/widgetManager';

/**
 * Create and validate an Algorand client
 */
function createAlgoClient(algodUrl: string, token:string): algosdk.Algodv2 | null {
  if (!algodUrl) {
    console.error('Algorand node URL not configured');
    return null;
  }
  
  return new algosdk.Algodv2(token, algodUrl, '');
}

/**
 * Register transaction API tools to the MCP server
 */
export function registerTransactionApiTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  // Register pending transaction widget
  const pendingTxnResourceUri = 'ui://algod/pending-txn.html';
  registerWidget(server, assets, {
    name: 'pending-txn-widget',
    htmlPath: '/widgets/pending-txn.html',
    resourceUri: pendingTxnResourceUri,
    description: 'Pending transaction card with status, type, addresses, amount, and pool error',
  });

  // Get transaction information by ID
  server.registerTool(
    'algod_get_pending_txn_info',
    {
      description: 'Get transaction details from algod by transaction ID',
      inputSchema: {
        txid: z.string().describe('The transaction ID')
      },
      _meta: {
        ui: { resourceUri: pendingTxnResourceUri },
        'ui/resourceUri': pendingTxnResourceUri,
      },
    },
    async ({ txid }) => {

      if (!env.ALGORAND_ALGOD) {
        return {
          content: [{
            type: 'text',
            text: 'Algorand node URL not configured'
          }]
        };
      }

      try {
        // Create algod client
        const algodClient = createAlgoClient(env.ALGORAND_ALGOD, env.ALGORAND_TOKEN || '');
        if (!algodClient) {
          throw new Error('Failed to create Algorand client');
        }

        // Get transaction information
        const response = await algodClient.pendingTransactionInformation(String(txid)).do();

        // Extract normalized fields for widget
        const raw = response as any;
        const poolError: string = raw?.poolError ?? raw?.['pool-error'] ?? '';
        const confirmedRound = raw?.confirmedRound ?? raw?.['confirmed-round'];
        const txnObj = raw?.txn?.txn ?? raw?.txn ?? {};
        const type: string = txnObj?.type ?? '';
        const sender: string = txnObj?.snd ? algosdk.encodeAddress(txnObj.snd) : (txnObj?.sender ?? '');
        const receiver: string | undefined = txnObj?.rcv ? algosdk.encodeAddress(txnObj.rcv) : txnObj?.receiver;
        const amount: number | undefined = txnObj?.amt !== undefined ? Number(txnObj.amt) : undefined;
        const fee: number | undefined = txnObj?.fee !== undefined ? Number(txnObj.fee) : undefined;
        const firstValid: number | undefined = txnObj?.fv !== undefined ? Number(txnObj.fv) : undefined;
        const lastValid: number | undefined = txnObj?.lv !== undefined ? Number(txnObj.lv) : undefined;
        const assetId: number | undefined = txnObj?.xaid !== undefined ? Number(txnObj.xaid) : undefined;
        const noteBytes: Uint8Array | undefined = txnObj?.note;
        const note: string | undefined = noteBytes ? (() => { try { return new TextDecoder().decode(noteBytes); } catch { return undefined; } })() : undefined;

        const status: 'pending' | 'confirmed' | 'error' = poolError
          ? 'error'
          : (confirmedRound && Number(confirmedRound) > 0 ? 'confirmed' : 'pending');

        const pendingTxn = {
          txid: String(txid),
          status,
          poolError,
          confirmedRound: confirmedRound ? Number(confirmedRound) : undefined,
          type,
          sender: sender || undefined,
          receiver,
          amount,
          fee,
          firstValid,
          lastValid,
          assetId,
          note,
        };

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(response);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify(pendingTxn);
        } catch {
          textContent = JSON.stringify(pendingTxn);
        }
        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { structuredData: true, pendingTxn },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error getting transaction info: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
  
  // Get pending transactions
  // server.tool(
  //   'algod_get_pending_transactions',
  //   'Get pending transactions from algod mempool',
  //   {
  //     maxResults: z.number().int().min(1).max(1000).default(50).describe('Maximum number of transactions to return')
  //   },
  //   async ({ maxResults }) => {
      
  //     if (!env.ALGORAND_ALGOD) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: 'Algorand node URL not configured'
  //         }]
  //       };
  //     }
      
  //     try {
  //       // Create algod client
  //       const algodClient = createAlgoClient(env.ALGORAND_ALGOD, env.ALGORAND_TOKEN || '');
  //       if (!algodClient) {
  //         throw new Error('Failed to create Algorand client');
  //       }
        
  //       // Get pending transactions
  //       const response = await algodClient.pendingTransactionsInformation().max(Number(maxResults)).do();
        
  //       return ResponseProcessor.processResponse(response);
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error getting pending transactions: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
  
  // Note: Transaction proofs are available in newer versions of algosdk but not in the current version
}
