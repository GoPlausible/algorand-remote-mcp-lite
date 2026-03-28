/**
 * Algod Account API Tools
 * Direct access to Algorand node account data
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
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
  registerAppTool(server,
    'algod_get_account_info',
    {
      description: 'Get current account balance, assets, and auth address from algod',
      inputSchema: {
        address: z.string().describe('The account public key'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: accountCardResourceUri },
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

  // Register account asset holding widget
  const assetHoldingResourceUri = 'ui://algod/account-asset-holding.html';
  registerWidget(server, assets, {
    name: 'account-asset-holding-widget',
    htmlPath: '/widgets/account-asset-holding.html',
    resourceUri: assetHoldingResourceUri,
    description: 'Asset holding card showing amount, frozen status, and explorer links',
  });

  // Get account asset information
  registerAppTool(server,
    'algod_get_account_asset_info',
    {
      description: 'Get account-specific asset information from algod',
      inputSchema: {
        address: z.string().describe('The account public key'),
        assetId: z.number().int().describe('The asset ID')
      },
      _meta: {
        ui: { resourceUri: assetHoldingResourceUri },
      },
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

        const holding = (response as any)?.['asset-holding'] ?? (response as any)?.assetHolding ?? response as any;
        const assetHolding = {
          address: String(address),
          assetId: Number(assetId),
          amount: Number(holding?.amount ?? 0),
          isFrozen: Boolean(holding?.['is-frozen'] ?? holding?.isFrozen ?? false),
        };

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(response);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify(assetHolding);
        } catch {
          textContent = JSON.stringify(assetHolding);
        }
        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { assetHolding },
        };
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
