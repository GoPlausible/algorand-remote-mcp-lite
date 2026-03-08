/**
 * Indexer Asset API Tools
 * Direct access to Algorand indexer asset data
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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
 * Register indexer asset API tools to the MCP server
 */
export function registerIndexerAssetTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  // Register asset search indexer widget
  const assetSearchIndexerResourceUri = 'ui://indexer/asset-search-indexer.html';
  registerWidget(server, assets, {
    name: 'asset-search-indexer-widget',
    htmlPath: '/widgets/asset-search-indexer.html',
    resourceUri: assetSearchIndexerResourceUri,
    description: 'Asset search results table UI widget',
  });
  // Lookup asset by ID
  // server.tool(
  //   'indexer_lookup_asset_by_id',
  //   'Get asset information from indexer',
  //   { 
  //     assetId: z.number().int().describe('Asset ID')
  //   },
  //   async ({ assetId }) => {
      
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
        
  //       // Lookup asset by ID
  //       const response = await indexerClient.lookupAssetByID(Number(assetId)).do();
        
  //       return ResponseProcessor.processResponse(response);
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error looking up asset: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
  
  // Register asset holders widget
  const assetHoldersResourceUri = 'ui://indexer/asset-holders.html';
  registerWidget(server, assets, {
    name: 'asset-holders-widget',
    htmlPath: '/widgets/asset-holders.html',
    resourceUri: assetHoldersResourceUri,
    description: 'Asset holders table UI widget',
  });

  // Lookup asset balances
  server.registerTool(
    'indexer_lookup_asset_balances',
    {
      description: 'Get accounts that hold a specific asset',
      inputSchema: {
        assetId: z.number().int().describe('Asset ID'),
        limit: z.number().int().optional().describe('Maximum number of accounts to return'),
        currencyGreaterThan: z.number().int().optional().describe('Filter by minimum balance'),
        currencyLessThan: z.number().int().optional().describe('Filter by maximum balance'),
        nextToken: z.string().optional().describe('Token for retrieving the next page of results'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: assetHoldersResourceUri },
        'ui/resourceUri': assetHoldersResourceUri,
      },
    },
    async ({ assetId, limit, currencyGreaterThan, currencyLessThan, nextToken, pageToken }) => {

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

        // Setup lookup with parameters
        let search = indexerClient.lookupAssetBalances(Number(assetId));

        if (limit) {
          search = search.limit(Number(limit));
        }
        if (currencyGreaterThan) {
          search = search.currencyGreaterThan(Number(currencyGreaterThan));
        }
        if (currencyLessThan) {
          search = search.currencyLessThan(Number(currencyLessThan));
        }
        if (nextToken) {
          search = search.nextToken(String(nextToken));
        }

        // Execute lookup
        const response = await search.do();
        const balances = (response.balances || []).map((b: any) => ({
          address: b.address,
          amount: Number(b.amount ?? 0),
          isFrozen: Boolean(b.isFrozen ?? b['is-frozen'] ?? false),
          deleted: Boolean(b.deleted ?? false),
          optedInAtRound: Number(b.optedInAtRound ?? b['opted-in-at-round'] ?? 0),
        }));

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse({ balances }, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ assetId, holderCount: balances.length });
        } catch {
          textContent = JSON.stringify({ assetId, holderCount: balances.length });
        }

        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textContent) }],
          structuredContent: {
            structuredData: true,
            assetHolders: {
              assetId,
              balances,
              totalHolders: balances.length,
              nextToken: response.nextToken || null,
            }
          },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error looking up asset balances: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
  
  // Search for assets
  server.registerTool(
    'indexer_search_for_assets',
    {
      description: 'Search for assets with various criteria',
      inputSchema: {
        name: z.string().optional().describe('Filter by asset name'),
        unit: z.string().optional().describe('Filter by asset unit name'),
        creator: z.string().optional().describe('Filter by creator address'),
        limit: z.number().int().optional().describe('Maximum number of assets to return'),
        nextToken: z.string().optional().describe('Token for retrieving the next page of results'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: assetSearchIndexerResourceUri },
        'ui/resourceUri': assetSearchIndexerResourceUri,
      },
    },
    async ({ name, unit, creator, limit, nextToken, pageToken }) => {

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

        // Setup search with parameters
        let search = indexerClient.searchForAssets();

        if (name) {
          search = search.name(String(name));
        }
        if (unit) {
          search = search.unit(String(unit));
        }
        if (creator) {
          search = search.creator(String(creator));
        }
        if (limit) {
          search = search.limit(Number(limit));
        }
        if (nextToken) {
          search = search.nextToken(String(nextToken));
        }

        // Execute search
        const response = await search.do();
        const assetsList = (response.assets || []).map((a: any) => {
          const params = a.params || {};
          return {
            index: Number(a.index ?? 0),
            name: params.name || null,
            unitName: params.unitName ?? params['unit-name'] ?? null,
            total: Number(params.total ?? 0),
            decimals: Number(params.decimals ?? 0),
            creator: params.creator || null,
            defaultFrozen: Boolean(params.defaultFrozen ?? params['default-frozen'] ?? false),
            url: params.url || null,
            deleted: Boolean(a.deleted ?? false),
          };
        });

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse({ assets: assetsList }, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ assetCount: assetsList.length });
        } catch {
          textContent = JSON.stringify({ assetCount: assetsList.length });
        }

        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textContent) }],
          structuredContent: {
            structuredData: true,
            assetSearch: {
              assets: assetsList,
              totalAssets: assetsList.length,
              nextToken: response.nextToken || null,
              filters: { name, unit, creator },
            }
          },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error searching assets: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
