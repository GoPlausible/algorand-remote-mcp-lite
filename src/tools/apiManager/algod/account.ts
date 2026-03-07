/**
 * Algod Account API Tools
 * Direct access to Algorand node account data
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
function createAlgoClient(algodUrl: string, token: string): algosdk.Algodv2 | null {
  if (!algodUrl) {
    console.error('Algorand node URL not configured');
    return null;
  }

  return new algosdk.Algodv2(token, algodUrl, '');
}

/**
 * Register account API tools to the MCP server
 */
export function registerAccountApiTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  // Register account dashboard widget
  const accountCardResourceUri = 'ui://account/account-card.html';
  registerWidget(server, assets, {
    name: 'account-card-widget',
    htmlPath: '/widgets/account-card.html',
    resourceUri: accountCardResourceUri,
    description: 'Interactive account dashboard UI widget',
  });

  // Get account information
  server.registerTool(
    'algod_get_account_info',
    {
      description: 'Get current account balance, assets, and auth address from algod',
      inputSchema: {
        address: z.string().describe('The account public key'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: accountCardResourceUri },
        'ui/resourceUri': accountCardResourceUri,
      },
    },
    async ({ address, pageToken }) => {

      if (!env.ALGORAND_ALGOD) {
        return {
          content: [{
            type: 'text' as const,
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

        // Validate address format
        if (!algosdk.isValidAddress(address)) {
          throw new Error('Invalid Algorand address format');
        }

        // Get account information
        const response = await algodClient.accountInformation(String(address)).do();

        // Build structured content for the widget
        const allAssets = (response.assets || []).map((a: any) => ({
          assetId: Number(a.assetId ?? a['asset-id']),
          amount: Number(a.amount),
        }));

        // Paginate assets for structuredContent
        const assetsPerPage = 10;
        const assetPageNum = pageToken ? (() => {
          try { return Number.parseInt(atob(pageToken).replace('page_', '')) || 1; } catch { return 1; }
        })() : 1;
        const assetStartIdx = (assetPageNum - 1) * assetsPerPage;
        const assetEndIdx = assetStartIdx + assetsPerPage;
        const paginatedAssets = allAssets.slice(assetStartIdx, assetEndIdx);
        const totalAssetPages = Math.ceil(allAssets.length / assetsPerPage);

        const accountDashboard = {
          address,
          amount: Number(response.amount),
          minBalance: Number(response.minBalance ?? 0),
          status: response.status || 'Offline',
          authAddr: response.authAddr ?? undefined,
          totalAssets: allAssets.length,
          totalApps: (response.appsLocalState || []).length,
          totalCreatedAssets: (response.createdAssets || []).length,
          totalCreatedApps: (response.createdApps || []).length,
          assets: paginatedAssets,
          assetPagination: allAssets.length > assetsPerPage ? {
            currentPage: assetPageNum,
            totalPages: totalAssetPages,
            hasNextPage: assetEndIdx < allAssets.length,
            hasPrevPage: assetPageNum > 1,
          } : undefined,
        };

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(response, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ address, amount: accountDashboard.amount });
        } catch {
          textContent = JSON.stringify({ address, amount: accountDashboard.amount });
        }
        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { accountDashboard },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error getting account info: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Get account application information (commented out)
  // ...

  // Get account asset information
  server.tool(
    'algod_get_account_asset_info',
    'Get account-specific asset information from algod',
    {
      address: z.string().describe('The account public key'),
      assetId: z.number().int().describe('The asset ID')
    },
    async ({ address, assetId }) => {

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

        // Validate address format
        if (!algosdk.isValidAddress(address)) {
          throw new Error('Invalid Algorand address format');
        }

        // Get account asset information
        const response = await algodClient.accountAssetInformation(String(address), Number(assetId)).do();

        return ResponseProcessor.processResponse(response);
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error getting account asset info: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
