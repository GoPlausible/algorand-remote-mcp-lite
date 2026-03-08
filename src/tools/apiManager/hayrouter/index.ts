/**
 * Haystack Router Tools for Algorand Remote MCP
 * DEX aggregator that finds the best swap route across multiple Algorand DEXes
 */

import { z } from 'zod';
import * as algosdk from 'algosdk';
import * as msgpack from 'algo-msgpack-with-bigint';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResponseProcessor } from '../../../utils';
import type { Env, Props } from '../../../types';
import { getRouterClient } from './routerClient';
import {
  getUserAddress,
  getPublicKey,
  signWithTransit
} from '../../../utils/vaultManager';
import { type AssetsBinding, registerWidget } from '../../../ui/widgetManager';

function ConcatArrays(...arrs: ArrayLike<number>[]) {
  const size = arrs.reduce((sum, arr) => sum + arr.length, 0);
  const c = new Uint8Array(size);
  let offset = 0;
  for (let i = 0; i < arrs.length; i++) {
    c.set(arrs[i], offset);
    offset += arrs[i].length;
  }
  return c;
}

/**
 * Register Haystack Router tools to the MCP server
 */
export function registerHaystackRouterTools(server: McpServer, env: Env, props: Props, assets?: AssetsBinding): void {
  // Register swap quote widget
  const swapQuoteResourceUri = 'ui://swap/swap-quote-card.html';
  registerWidget(server, assets, {
    name: 'swap-quote-card-widget',
    htmlPath: '/widgets/swap-quote-card.html',
    resourceUri: swapQuoteResourceUri,
    description: 'Interactive swap quote card UI widget',
  });

  // Register swap result widget
  const swapResultResourceUri = 'ui://swap/swap-result-card.html';
  registerWidget(server, assets, {
    name: 'swap-result-card-widget',
    htmlPath: '/widgets/swap-result-card.html',
    resourceUri: swapResultResourceUri,
    description: 'Swap execution result card UI widget',
  });

  // Get swap quote
  server.registerTool(
    'haystack_get_swap_quote',
    {
      description: 'Get an optimized swap quote from Haystack Router — a DEX aggregator that finds the best swap route across multiple Algorand DEXes (Tinyman V2, Pact, Folks) and LST protocols (tALGO, xALGO). Returns the best-price quote with route details, USD values, and price impact. All amounts are in base units (e.g., 1000000 = 1 ALGO).',
      inputSchema: {
        fromASAID: z.number().int().describe('Input asset ID (0 = ALGO, 31566704 = USDC, 312769 = USDt, etc.)'),
        toASAID: z.number().int().describe('Output asset ID (0 = ALGO, 31566704 = USDC, 312769 = USDt, etc.)'),
        amount: z.number().int().describe('Amount in base units (e.g., 1000000 = 1 ALGO with 6 decimals)'),
        type: z.enum(['fixed-input', 'fixed-output']).default('fixed-input').describe('Quote type: fixed-input or fixed-output'),
        address: z.string().optional().describe('User Algorand address (optional, needed for auto opt-in detection)'),
        maxGroupSize: z.number().int().optional().default(16).describe('Maximum transactions in atomic group'),
        maxDepth: z.number().int().optional().default(4).describe('Maximum routing hops')
      },
      _meta: {
        ui: { resourceUri: swapQuoteResourceUri },
        'ui/resourceUri': swapQuoteResourceUri,
      },
    },
    async ({ fromASAID, toASAID, amount, type, address, maxGroupSize, maxDepth }) => {
      try {
        const router = getRouterClient(env);

        const quoteParams: any = {
          fromASAID,
          toASAID,
          amount: BigInt(amount),
          type,
        };

        if (address) quoteParams.address = address;
        if (maxGroupSize !== undefined) quoteParams.maxGroupSize = maxGroupSize;
        if (maxDepth !== undefined) quoteParams.maxDepth = maxDepth;

        const quote = await router.newQuote(quoteParams);

        const result: any = {
          expectedOutput: quote.quote.toString(),
          inputAmount: quote.amount.toString(),
          fromASAID: quote.fromASAID,
          toASAID: quote.toASAID,
          type: quote.type,
          usdIn: quote.usdIn,
          usdOut: quote.usdOut,
          userPriceImpact: quote.userPriceImpact,
          marketPriceImpact: quote.marketPriceImpact,
          route: quote.route,
          flattenedRoute: quote.flattenedRoute,
          requiredAppOptIns: quote.requiredAppOptIns,
          protocolFees: quote.protocolFees,
          createdAt: quote.createdAt,
        };

        if (quote.address) {
          result.address = quote.address;
        }

        // Sanitize result to ensure no BigInt values remain (route/flattenedRoute may contain them)
        const safeResult = JSON.parse(JSON.stringify(result, (_k, v) =>
          typeof v === 'bigint' ? (v >= Number.MIN_SAFE_INTEGER && v <= Number.MAX_SAFE_INTEGER ? Number(v) : v.toString()) : v
        ));

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(safeResult);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify(safeResult);
        } catch {
          textContent = JSON.stringify(safeResult);
        }

        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textContent) }],
          structuredContent: { structuredData: true, swapQuote: safeResult },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to get Haystack swap quote: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Execute swap
  server.registerTool(
    'haystack_execute_swap',
    {
      description: 'Execute an optimized token swap via Haystack Router — gets the best route across multiple DEXes (Tinyman V2, Pact, Folks) and LST protocols, then signs with the vault wallet and submits. This is an all-in-one tool: quote → sign → submit → confirm. All amounts are in base units.',
      inputSchema: {
        fromASAID: z.number().int().describe('Input asset ID (0 = ALGO, 31566704 = USDC, 312769 = USDt, etc.)'),
        toASAID: z.number().int().describe('Output asset ID (0 = ALGO, 31566704 = USDC, 312769 = USDt, etc.)'),
        amount: z.number().int().describe('Amount in base units (e.g., 1000000 = 1 ALGO with 6 decimals)'),
        slippage: z.number().optional().default(1).describe('Slippage tolerance percentage (e.g., 1 = 1%)'),
        type: z.enum(['fixed-input', 'fixed-output']).default('fixed-input').describe('Quote type'),
        note: z.string().optional().describe('Optional note to attach to the input transaction'),
        maxGroupSize: z.number().int().optional().default(16).describe('Maximum transactions in atomic group'),
        maxDepth: z.number().int().optional().default(4).describe('Maximum routing hops'),
      },
      _meta: {
        ui: { resourceUri: swapResultResourceUri },
        'ui/resourceUri': swapResultResourceUri,
      },
    },
    async ({ fromASAID, toASAID, amount, slippage, type, note, maxGroupSize, maxDepth }) => {
      if (!props.email || !props.provider) {
        return {
          content: [{
            type: 'text',
            text: 'Email and provider must be provided for swap execution'
          }]
        };
      }

      try {
        // 1. Get user address and public key from vault
        const address = await getUserAddress(env, props.email, props.provider);
        if (!address) {
          throw new Error('No active agent wallet configured');
        }

        const publicKeyResult = await getPublicKey(env, props.email, props.provider);
        if (!publicKeyResult.success || !publicKeyResult.publicKey) {
          throw new Error('Failed to get public key from vault');
        }

        // 2. Create a vault-based signer
        const signer = async (
          txnGroup: algosdk.Transaction[],
          indexesToSign: number[],
        ): Promise<Uint8Array[]> => {
          const results: Uint8Array[] = [];

          for (const index of indexesToSign) {
            const txn = txnGroup[index];
            const encodedTxn = algosdk.encodeUnsignedTransaction(txn);

            // Prepend "TX" tag for signing
            const TAG = Buffer.from('TX');
            const taggedTxn = ConcatArrays(TAG, encodedTxn);
            const taggedTxnBase64 = Buffer.from(taggedTxn).toString('base64');

            // Sign with vault
            const signatureResult = await signWithTransit(env, taggedTxnBase64, props.email!, props.provider!);
            if (!signatureResult.success || !signatureResult.signature) {
              throw new Error(`Failed to sign transaction at index ${index} with vault`);
            }

            const signature = new Uint8Array(Buffer.from(signatureResult.signature, 'base64'));

            // Construct signed transaction using msgpack
            const txnObj = msgpack.decode(algosdk.encodeUnsignedTransaction(txn));
            const signedTxn: any = {
              txn: txnObj,
              sig: signature,
            };

            results.push(new Uint8Array(msgpack.encode(signedTxn, { sortKeys: true, ignoreUndefined: true })));
          }

          return results;
        };

        // 3. Get router client and fetch quote
        const router = getRouterClient(env);

        const quoteParams: any = {
          fromASAID,
          toASAID,
          amount: BigInt(amount),
          type,
          address,
        };
        if (maxGroupSize !== undefined) quoteParams.maxGroupSize = maxGroupSize;
        if (maxDepth !== undefined) quoteParams.maxDepth = maxDepth;

        const quote = await router.newQuote(quoteParams);

        // 4. Build and execute swap
        const swapConfig: any = {
          quote,
          address,
          signer,
          slippage,
        };
        if (note) {
          swapConfig.note = new TextEncoder().encode(note);
        }

        const swap = await router.newSwap(swapConfig);
        const result = await swap.execute();

        // 5. Get swap summary
        const summary = swap.getSummary();
        const inputTxnId = swap.getInputTransactionId();

        // 6. Build response
        const response: any = {
          status: 'confirmed',
          confirmedRound: result.confirmedRound.toString(),
          txIds: result.txIds,
          signer: address,
          network: env.ALGORAND_NETWORK || 'mainnet',
          quote: {
            fromASAID: quote.fromASAID,
            toASAID: quote.toASAID,
            expectedOutput: quote.quote.toString(),
            inputAmount: quote.amount.toString(),
            type: quote.type,
            usdIn: quote.usdIn,
            usdOut: quote.usdOut,
            userPriceImpact: quote.userPriceImpact,
            route: quote.flattenedRoute,
          },
          slippage,
        };

        if (summary) {
          response.summary = {
            inputAssetId: summary.inputAssetId.toString(),
            outputAssetId: summary.outputAssetId.toString(),
            inputAmount: summary.inputAmount.toString(),
            outputAmount: summary.outputAmount.toString(),
            totalFees: summary.totalFees.toString(),
            transactionCount: summary.transactionCount,
            inputTxnId: summary.inputTxnId,
            outputTxnId: summary.outputTxnId,
          };
        }

        if (inputTxnId) {
          response.inputTransactionId = inputTxnId;
        }

        const swapResult = JSON.parse(JSON.stringify(response, (_k, v) =>
          typeof v === 'bigint' ? v.toString() : v
        ));
        const textContent = JSON.stringify({ structuredData: true, swapResult }, null, 2);
        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { structuredData: true, swapResult },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Haystack swap failed: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Check opt-in status
  server.registerTool(
    'haystack_needs_optin',
    {
      description: 'Check if an Algorand address needs to opt into an asset before swapping. Returns true if opt-in is needed. Always returns false for ALGO (ASA 0).',
      inputSchema: {
        address: z.string().describe('Algorand address to check'),
        assetId: z.number().int().describe('Asset ID to check opt-in status for')
      },
    },
    async ({ address, assetId }) => {
      try {
        const router = getRouterClient(env);
        const needsOptIn = await router.needsAssetOptIn(address, assetId);

        return ResponseProcessor.processResponse({
          address,
          assetId,
          needsOptIn,
          network: env.ALGORAND_NETWORK || 'mainnet',
        });
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Failed to check asset opt-in: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
