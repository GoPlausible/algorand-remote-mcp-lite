/**
 * Indexer Account API Tools
 * Direct access to Algorand indexer account data
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
 * Register indexer account API tools to the MCP server
 */
export function registerIndexerAccountTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  // Register account assets widget
  const accountAssetsResourceUri = 'ui://indexer/account-assets.html';
  registerWidget(server, assets, {
    name: 'account-assets-widget',
    htmlPath: '/widgets/account-assets.html',
    resourceUri: accountAssetsResourceUri,
    description: 'Account asset holdings table UI widget',
  });

  // Register account search widget
  const accountSearchResourceUri = 'ui://indexer/account-search.html';
  registerWidget(server, assets, {
    name: 'account-search-widget',
    htmlPath: '/widgets/account-search.html',
    resourceUri: accountSearchResourceUri,
    description: 'Account search results table UI widget',
  });
  // Lookup account by ID
  // server.tool(
  //   'indexer_lookup_account_by_id',
  //   'Get account information from indexer',
  //   { 
  //     address: z.string().describe('Account address')
  //   },
  //   async ({ address }) => {
      
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
        
  //       // Lookup account by ID
  //       const response = await indexerClient.lookupAccountByID(String(address)).do();
        
  //       return ResponseProcessor.processResponse(response);
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error looking up account: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
  
  // Lookup account assets
  registerAppTool(server,
    'indexer_lookup_account_assets',
    {
      description: 'Get account assets',
      inputSchema: {
        address: z.string().describe('Account address'),
        limit: z.number().int().optional().describe('Maximum number of assets to return'),
        assetId: z.number().int().optional().describe('Filter by asset ID'),
        nextToken: z.string().optional().describe('Token for retrieving the next page of results'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: accountAssetsResourceUri },
      },
    },
    async ({ address, limit, assetId, nextToken, pageToken }) => {

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
        let search = indexerClient.lookupAccountAssets(String(address));

        if (limit) {
          search = search.limit(Number(limit));
        }
        if (assetId) {
          search = search.assetId(Number(assetId));
        }
        if (nextToken) {
          search = search.nextToken(String(nextToken));
        }

        // Execute lookup
        const response = await search.do();
        const assetsList = (response.assets || []).map((a: any) => ({
          assetId: Number(a.assetId ?? a['asset-id'] ?? 0),
          amount: Number(a.amount ?? 0),
          isFrozen: Boolean(a.isFrozen ?? a['is-frozen'] ?? false),
          deleted: Boolean(a.deleted ?? false),
          optedInAtRound: Number(a.optedInAtRound ?? a['opted-in-at-round'] ?? 0),
        }));

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse({ assets: assetsList }, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ address, assetCount: assetsList.length });
        } catch {
          textContent = JSON.stringify({ address, assetCount: assetsList.length });
        }

        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: {
            accountAssets: {
              address,
              assets: assetsList,
              totalAssets: assetsList.length,
              'next-token': (response as any)['next-token'] || null,
            }
          },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error looking up account assets: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
  
  // Lookup account app local states
  // server.tool(
  //   'indexer_lookup_account_app_local_states',
  //   'Get account application local states',
  //   { 
  //     address: z.string().describe('Account address')
  //   },
  //   async ({ address }) => {
      
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
        
  //       // Lookup account app local states
  //       const response = await indexerClient.lookupAccountAppLocalStates(String(address)).do();
        
  //       return ResponseProcessor.processResponse(response);
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error looking up account app local states: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
  
  // Lookup account created applications
  // server.tool(
  //   'indexer_lookup_account_created_apps',
  //   'Get applications created by this account',
  //   { 
  //     address: z.string().describe('Account address')
  //   },
  //   async ({ address }) => {
      
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
        
  //       // Lookup account created applications
  //       const response = await indexerClient.lookupAccountCreatedApplications(String(address)).do();
        
  //       // Format response to only return the applications array
  //       return ResponseProcessor.processResponse({
  //         applications: response.applications || []
  //       });
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error looking up account created applications: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
  
  // Search for accounts
  registerAppTool(server,
    'indexer_search_for_accounts',
    {
      description: 'Search for accounts with various criteria',
      inputSchema: {
        limit: z.number().int().optional().describe('Maximum number of accounts to return'),
        assetId: z.number().int().optional().describe('Filter by asset ID'),
        applicationId: z.number().int().optional().describe('Filter by application ID'),
        currencyGreaterThan: z.number().int().optional().describe('Filter by minimum balance'),
        currencyLessThan: z.number().int().optional().describe('Filter by maximum balance'),
        nextToken: z.string().optional().describe('Token for retrieving the next page of results'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: accountSearchResourceUri },
      },
    },
    async ({ limit, assetId, applicationId, currencyGreaterThan, currencyLessThan, nextToken, pageToken }) => {

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
        let search = indexerClient.searchAccounts();

        if (limit) {
          search = search.limit(Number(limit));
        }
        if (assetId) {
          search = search.assetID(Number(assetId));
        }
        if (applicationId) {
          search = search.applicationID(Number(applicationId));
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

        // Execute search
        const response = await search.do();
        const accountsList = (response.accounts || []).map((a: any) => ({
          address: a.address,
          amount: Number(a.amount ?? 0),
          totalAssetsOptedIn: Number(a.totalAssetsOptedIn ?? a['total-assets-opted-in'] ?? 0),
          totalCreatedAssets: Number(a.totalCreatedAssets ?? a['total-created-assets'] ?? 0),
          totalCreatedApps: Number(a.totalCreatedApps ?? a['total-created-apps'] ?? 0),
          totalAppsOptedIn: Number(a.totalAppsOptedIn ?? a['total-apps-opted-in'] ?? 0),
          status: a.status || 'Offline',
          authAddr: a.authAddr ?? a['auth-addr'] ?? undefined,
        }));

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse({ accounts: accountsList }, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ accountCount: accountsList.length });
        } catch {
          textContent = JSON.stringify({ accountCount: accountsList.length });
        }

        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: {
            accountSearch: {
              accounts: accountsList,
              totalAccounts: accountsList.length,
              'next-token': (response as any)['next-token'] || null,
              filters: { assetId, applicationId, currencyGreaterThan, currencyLessThan },
            }
          },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error searching accounts: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
