/**
 * NFD API Manager
 * Provides tools for interacting with the Algorand Name Service
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResponseProcessor } from '../../../utils';
import type { Env } from '../../../types';
import { type AssetsBinding, registerWidget } from '../../../ui/widgetManager';

/**
 * Register NFD API tools to the MCP server
 */
export function registerNfdApiTools(server: McpServer, env: Env, assets?: AssetsBinding): void {

  // Register NFD card widget resource
  const nfdCardResourceUri = 'ui://nfd/nfd-card.html';
  registerWidget(server, assets, {
    name: 'nfd-card-widget',
    htmlPath: '/widgets/nfd-card.html',
    resourceUri: nfdCardResourceUri,
    description: 'Interactive NFD account card UI widget',
    resourceDomains: ['https://ipfs.io', 'https://gateway.pinata.cloud', 'https://cloudflare-ipfs.com'],
  });

  // Get NFD by name (with account info and UI)
  server.registerTool(
    'api_nfd_get_nfd',
    {
      description: 'Get NFD domain information by name, including the linked Algorand account balance and assets',
      inputSchema: {
        name: z.string().describe('NFD domain name, e.g. "example.algo"'),
        view: z.enum(['brief', 'full']).optional().default('full').describe('View type - brief or full'),
        includeSales: z.boolean().optional().default(false).describe('Include sales data'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: nfdCardResourceUri },
        'ui/resourceUri': nfdCardResourceUri,
      },
    },
    async ({ name, view, includeSales, pageToken }) => {
      try {
        const apiBase = env.NFD_API_URL || 'https://api.nf.domains';

        let url = `${apiBase}/nfd/${encodeURIComponent(name.toLowerCase())}`;
        const params = new URLSearchParams();

        if (view) {
          params.append('view', view);
        }

        if (includeSales) {
          params.append('includeSales', 'true');
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`NFD request failed with status: ${response.status}`);
        }

        const nfdData: any = await response.json();

        // Extract the deposit address from NFD data
        const depositAddress = nfdData.depositAccount
          || nfdData.caAlgo?.[0]
          || nfdData.owner
          || null;

        // Fetch account info from algod if we have an address
        let accountAmount = 0;
        let accountAssets: Array<{ assetId: number; amount: number }> = [];

        if (depositAddress && env.ALGORAND_ALGOD) {
          try {
            const algodClient = new algosdk.Algodv2(env.ALGORAND_TOKEN || '', env.ALGORAND_ALGOD, '');
            const accountInfo = await algodClient.accountInformation(depositAddress).do();
            accountAmount = Number(accountInfo.amount);
            accountAssets = (accountInfo.assets || []).map((a: any) => ({
              assetId: Number(a.assetId ?? a['asset-id']),
              amount: Number(a.amount),
            }));
          } catch (err: any) {
            console.error(`Failed to fetch account info for ${depositAddress}:`, err.message);
          }
        }

        // Extract NFD metadata for the UI
        // NFD API nests properties under properties.data.{section}.data (full view)
        // or properties.{section} (brief view)
        const propsData = nfdData.properties?.data || nfdData.properties || {};
        const userDefined = propsData.userDefined?.data || propsData.userDefined || {};
        const verified = propsData.verified?.data || propsData.verified || {};

        // Convert IPFS URI to HTTPS gateway URL
        const rawAvatar = verified.avatar || userDefined.avatar || null;
        const avatarUrl = rawAvatar?.startsWith('ipfs://')
          ? `https://ipfs.io/ipfs/${rawAvatar.slice(7)}`
          : rawAvatar;

        // Paginate assets for structuredContent (10 per page)
        const assetsPerPage = 10;
        const assetPageNum = pageToken ? (() => {
          try { return Number.parseInt(atob(pageToken).replace('page_', '')) || 1; } catch { return 1; }
        })() : 1;
        const assetStartIdx = (assetPageNum - 1) * assetsPerPage;
        const assetEndIdx = assetStartIdx + assetsPerPage;
        const paginatedAssets = accountAssets.slice(assetStartIdx, assetEndIdx);
        const totalAssetPages = Math.ceil(accountAssets.length / assetsPerPage);

        const nfdAccount = {
          nfdName: nfdData.name || name,
          avatar: avatarUrl,
          address: depositAddress || '',
          amount: accountAmount,
          assets: paginatedAssets,
          totalAssets: accountAssets.length,
          showAssets: view === 'full',
          assetPagination: accountAssets.length > assetsPerPage ? {
            currentPage: assetPageNum,
            totalPages: totalAssetPages,
            hasNextPage: assetEndIdx < accountAssets.length,
            hasPrevPage: assetPageNum > 1,
          } : undefined,
          category: nfdData.category || null,
          state: nfdData.state || null,
          owner: nfdData.owner || null,
          tags: (nfdData.metaTags || nfdData.tags || []) as string[],
          bio: userDefined.bio || null,
          website: userDefined.website || verified.website || null,
          twitter: userDefined.twitter || verified.twitter || null,
          discord: userDefined.discord || verified.discord || null,
        };

        const combinedData = { ...nfdData, account: { address: depositAddress, amount: accountAmount, assets: accountAssets } };
        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(combinedData, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ name: nfdAccount.nfdName, address: depositAddress });
        } catch {
          textContent = JSON.stringify({ name: nfdAccount.nfdName, address: depositAddress });
        }

        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { nfdAccount },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `NFD lookup error: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Register NFD list widget
  const nfdListResourceUri = 'ui://nfd/nfd-list.html';
  registerWidget(server, assets, {
    name: 'nfd-list-widget',
    htmlPath: '/widgets/nfd-list.html',
    resourceUri: nfdListResourceUri,
    description: 'NFD names list for an address UI widget',
    resourceDomains: ['https://ipfs.io', 'https://gateway.pinata.cloud', 'https://cloudflare-ipfs.com'],
  });

  // Get NFDs for address
  server.registerTool(
    'api_nfd_get_nfds_for_address',
    {
      description: 'Get all NFD names owned by an Algorand address',
      inputSchema: {
        address: z.string().describe('Algorand address'),
        limit: z.number().optional().default(50).describe('Maximum number of results'),
        offset: z.number().optional().default(0).describe('Offset for pagination'),
        view: z.enum(['brief', 'full']).optional().default('brief').describe('View type - brief or full')
      },
      _meta: {
        ui: { resourceUri: nfdListResourceUri },
        'ui/resourceUri': nfdListResourceUri,
      },
    },
    async ({ address, limit, offset, view }) => {
      try {
        const apiBase = env.NFD_API_URL || 'https://api.nf.domains';

        let url = `${apiBase}/nfd/address/${encodeURIComponent(address)}`;
        const params = new URLSearchParams();

        params.append('limit', String(limit));
        params.append('offset', String(offset));

        if (view) {
          params.append('view', view);
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`NFD address lookup failed with status: ${response.status}`);
        }

        const data: any = await response.json();
        const nfds = Array.isArray(data) ? data : [];

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(data);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ address, nfdCount: nfds.length });
        } catch {
          textContent = JSON.stringify({ address, nfdCount: nfds.length });
        }

        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: {
            nfdList: {
              address,
              nfds: nfds.map((nfd: any) => ({
                name: nfd.name,
                category: nfd.category || null,
                state: nfd.state || null,
                owner: nfd.owner || null,
                depositAccount: nfd.depositAccount || nfd.caAlgo?.[0] || null,
                avatar: (() => {
                  const raw = nfd.properties?.verified?.avatar || nfd.properties?.userDefined?.avatar || null;
                  return raw?.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${raw.slice(7)}` : raw;
                })(),
                tags: nfd.metaTags || nfd.tags || [],
              })),
              totalNfds: nfds.length,
            }
          },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `NFD domains lookup error: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
