/**
 * Algod Asset API Tools
 * Direct access to Algorand node asset data
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResponseProcessor } from '../../../utils';
import type { Env, AssetVerificationResponse, AssetDetailsResponse } from '../../../types';
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
   * Get assets by name
   * @param {string} name - Asset name
   * @returns {Array} - Array of assets matching the name
   */
async function getAssetsByName(name: string, env: Env) {
  if (!name || !env.VERIFIED_ASSETS) {
    throw new Error("Asset name is required");
  }

  // List keys with prefix of the name
  const keys = await env.VERIFIED_ASSETS.list({ prefix: `key-${name}-` });
  console.log(`[verified-assets-cron-worker] Found ${keys.keys.length} keys for name: ${name}`);

  // Fetch all assets with matching keys
  const assets = await Promise.all(
    keys.keys.map(async key => {
      if(!env.VERIFIED_ASSETS) return null;
      const assetData = await env.VERIFIED_ASSETS.get(key.name);
      console.log(`[verified-assets-cron-worker] Fetched asset data for key: ${key.name}`);
      return assetData ? JSON.parse(assetData): null;
    })
  );

  return assets;
}

/**
 * Get asset by asset ID
 * @param {number|string} assetId - Asset ID
 * @returns {Object|null} - Asset object or null if not found
 */
async function getAssetsByAssetId(assetId: number, env: Env) {
  if (!assetId || !env.VERIFIED_ASSETS) {
    throw new Error("Asset ID is required");
  }

  const key = `id-${assetId}`;
  console.log(`[verified-assets-cron-worker] Fetching asset by ID: ${assetId}`);
  const assetData = await env.VERIFIED_ASSETS.get(key);

  if (!assetData) {
    return null;
  }

  return JSON.parse(assetData);
}

/**
 * Get assets by creator address
 * @param {string} creatorAddress - Creator address
 * @returns {Array} - Array of assets created by the address
 */
async function getAssetsByCreatorAddress(creatorAddress: string, env: Env) {
  if (!creatorAddress || !env.VERIFIED_ASSETS) {
    throw new Error("Creator address is required");
  }

  // List keys with prefix of the creator address
  const keys = await env.VERIFIED_ASSETS.list({ prefix: `creator-${creatorAddress}-` });
  console.log(`[verified-assets-cron-worker] Found ${keys.keys.length} keys for creator address: ${creatorAddress}`);

  // Fetch all assets with matching keys
  const assets = await Promise.all(
    keys.keys.map(async (key) => {
      if(!env.VERIFIED_ASSETS) return null;
    
      const assetData = await env.VERIFIED_ASSETS.get(key.name);
      console.log(`[verified-assets-cron-worker] Fetched asset data for key: ${key.name}`);
      return assetData ? JSON.parse(assetData): null;
    })
  );

  return assets;
}

/**
 * Get assets by unit name
 * @param {string} unitName - Unit name
 * @returns {Array} - Array of assets matching the unit name
 */
async function getAssetsByUnitName(unitName: string, env: Env) {
  if (!unitName || !env.VERIFIED_ASSETS) {
    throw new Error("Unit name is required");
  }

  // List keys with prefix of the unit name
  const keys = await env.VERIFIED_ASSETS.list({ prefix: `unit-${unitName}-` });
  console.log(`[verified-assets-cron-worker] Found ${keys.keys.length} keys for unit name: ${unitName}`);

  // Fetch all assets with matching keys
  const assets = await Promise.all(
    keys.keys.map(async key => {
      if(!env.VERIFIED_ASSETS) return null;
      const assetData = await env.VERIFIED_ASSETS.get(key.name);
      console.log(`[verified-assets-cron-worker] Fetched asset data for key: ${key.name}`);
      return assetData ? JSON.parse(assetData): null;
    })
  );

  return assets;
}

/**
 * Get asset info by identifier (asset ID, name, or unit name)
 * Returns only verified assets, and if multiple assets match, filters by verification status
 * @param {string|number} identifier - Asset ID, name, or unit name
 * @param {boolean} verbose - Whether to return all asset details or just a summary
 * @returns {Object|null} - Asset object or null if not found
 */
// async function getAssetInfo(identifier: number, verbose: boolean = false, env: Env) {
//   if (!identifier) {
//     throw new Error("Identifier is required");
//   }

//   let assets = [];

//   // Try to get by asset ID first
//   if (!isNaN(identifier)) {
//     const asset = await getAssetsByAssetId(identifier, env);
//     if (asset) {
//       assets = [asset];
//     }
//   }
//   // If still not found and there was $ at the beginning, try by unit name
//   if (`${identifier}`.indexOf('$') === 0) {
//     assets = await getAssetsByUnitName(`${identifier}`, env);
//   }



//   // If still not found, try by asset name
//   if (assets.length === 0) {
//     assets = await getAssetsByName(`${identifier}`, env);
//   }

//   // If no assets found, return null
//   if (assets.length === 0) {
//     return null;
//   }

//   // Filter for verified assets only
//   const verifiedAssets = assets.filter(asset => asset.verification_tier === 'verified');

//   // If we have verified assets, use those, otherwise use all assets
//   const filteredAssets = verifiedAssets.length > 0 ? verifiedAssets : assets;

//   // If we have multiple assets, return the first one
//   const asset = filteredAssets[0];

//   // Return full asset or just summary based on verbose flag
//   if (verbose) {
//     return asset;
//   } else {
//     return {
//       asset_id: asset.asset_id,
//       name: asset.name,
//       unit_name: asset.unit_name,
//       verification_tier: asset.verification_tier
//     };
//   }
// }
/**
 * Register asset API tools to the MCP server
 */
export function registerAssetApiTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  // Register asset detail card widget
  const assetCardResourceUri = 'ui://asset/asset-card.html';
  registerWidget(server, assets, {
    name: 'asset-card-widget',
    htmlPath: '/widgets/asset-card.html',
    resourceUri: assetCardResourceUri,
    description: 'Interactive asset detail card UI widget',
    resourceDomains: ['https://asa-list.tinyman.org', 'https://algorand-wallet-mainnet.s3.amazonaws.com'],
  });
  // Get asset information
  server.registerTool(
    'algod_get_asset_info',
    {
      description: 'Get asset details from algod',
      inputSchema: {
        assetId: z.number().int().describe('The asset ID')
      },
      _meta: {
        ui: { resourceUri: assetCardResourceUri },
        'ui/resourceUri': assetCardResourceUri,
      },
    },
    async ({ assetId }) => {

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

        // Get asset information
        const response = await algodClient.getAssetByID(Number(assetId)).do();

        // Format the response to include more readable asset information
        const assetParams = response.params;
        const formattedResponse = {
          ...response,
          readableParams: {
            name: assetParams.name,
            unitName: assetParams.unitName,
            total: assetParams.total,
            decimals: assetParams.decimals,
            defaultFrozen: assetParams.defaultFrozen,
            creator: assetParams.creator,
            manager: assetParams.manager,
            reserve: assetParams.reserve,
            freeze: assetParams.freeze,
            clawback: assetParams.clawback,
            url: assetParams.url ? Buffer.from(assetParams.url).toString() : undefined,
            metadataHash: assetParams.metadataHash
              ? Buffer.from(assetParams.metadataHash).toString('hex')
              : undefined
          }
        };

        // Transform algod response to match AssetDetailsData for the asset-card widget
        const assetDetails = {
          asset_id: Number(assetId),
          name: assetParams.name || null,
          unit_name: assetParams.unitName || null,
          fraction_decimals: Number(assetParams.decimals ?? 0),
          total_supply: Number(assetParams.total ?? 0),
          total_supply_as_str: String(assetParams.total ?? '0'),
          creator_address: assetParams.creator || '',
          verification_tier: 'unverified' as const,
          is_collectible: false,
          circulating_supply: String(assetParams.total ?? '0'),
          url: assetParams.url ? Buffer.from(assetParams.url).toString() : null,
          logo: null,
          usd_value: null,
          description: null,
        };

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(formattedResponse);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify(assetDetails);
        } catch {
          textContent = JSON.stringify(assetDetails);
        }

        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textContent) }],
          structuredContent: { structuredData: true, assetDetails },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error getting asset info: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Get asset holding information
  // server.tool(
  //   'algod_get_asset_holding',
  //   'Get asset holding information for an account',
  //   {
  //     address: z.string().describe('Account address'),
  //     assetId: z.number().int().describe('The asset ID')
  //   },
  //   async ({ address, assetId }) => {

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

  //       // Validate address
  //       if (!algosdk.isValidAddress(address)) {
  //         throw new Error('Invalid Algorand address');
  //       }

  //       // Get asset holding information
  //       const accountInfo = await algodClient.accountInformation(String(address)).do();
  //       const assets = accountInfo.assets || [];

  //       // Find the specific asset
  //       const assetInfo = assets.find((asset: any) => asset['asset-id'] === assetId);

  //       if (!assetInfo) {
  //         return {
  //           content: [{
  //             type: 'text',
  //             text: `Account ${address} does not hold asset ${assetId}`
  //           }]
  //         };
  //       }

  //       const formattedResponse = {
  //         address,
  //         assetId,
  //         amount: assetInfo.amount,
  //         isFrozen: assetInfo['is-frozen'],
  //         optedIn: true
  //       };

  //       return ResponseProcessor.processResponse(formattedResponse);
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error getting asset holding: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
  // Get asset verification status from Pera Wallet
  // server.tool(
  //   'pera_asset_verification_status',
  //   'Get the verification status of an Algorand asset from Pera Wallet',
  //   {
  //     assetId: z.number().int().min(0).max(9223372036854776000)
  //       .describe('Asset ID to check verification status')
  //   },
  //   async ({ assetId }) => {
  //     // Get the Pera Wallet API URL from environment variables or use default
  //     const peraWalletApiBaseUrl = env.PERA_WALLET_API_URL || 'https://mainnet.api.perawallet.app/v1/public';
  //     const verificationEndpoint = `${peraWalletApiBaseUrl}/asset-verifications/${assetId}/`;

  //     try {
  //       // Make API request to Pera Wallet
  //       const response = await fetch(verificationEndpoint);

  //       if (!response.ok) {
  //         if (response.status === 404) {
  //           // Get the Pera Explorer URL from environment variables or use default
  //           const explorerBaseUrl = env.PERA_EXPLORER_URL || 'https://explorer.perawallet.app';
  //           return ResponseProcessor.processResponse({
  //             asset_id: assetId,
  //             verification_tier: "unverified" as const,
  //             explorer_url: `${explorerBaseUrl}/asset/${assetId}/`,
  //             message: "Asset not found in Pera verification database"
  //           });
  //         }

  //         throw new Error(`API request failed with status: ${response.status}`);
  //       }

  //       const data = await response.json() as AssetVerificationResponse;

  //       return ResponseProcessor.processResponse({
  //         asset_id: data.asset_id,
  //         verification_tier: data.verification_tier,
  //         explorer_url: data.explorer_url
  //       });
  //     } catch (error: any) {
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error checking asset verification status: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );

  // Get detailed asset information from Pera Wallet
  server.registerTool(
    'pera_verified_asset_query',
    {
      description: 'Get detailed information about an Algorand asset from Pera Wallet',
      inputSchema: {
        assetId: z.number().int().min(0)
          .describe('Asset ID to get detailed information')
      },
      _meta: {
        ui: { resourceUri: assetCardResourceUri },
        'ui/resourceUri': assetCardResourceUri,
      },
    },
    async ({ assetId }) => {
      const peraWalletApiBaseUrl = env.PERA_WALLET_API_URL || 'https://mainnet.api.perawallet.app/v1/public';
      const assetDetailsEndpoint = `${peraWalletApiBaseUrl}/assets/${assetId}/`;

      try {
        const response = await fetch(assetDetailsEndpoint);

        if (!response.ok) {
          if (response.status === 404) {
            return {
              content: [{
                type: 'text' as const,
                text: `Asset with ID ${assetId} not found in Pera Wallet database`
              }]
            };
          }

          throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = await response.json() as AssetDetailsResponse;

        const textResponse = ResponseProcessor.processResponse(data);
        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textResponse.content[0].text) }],
          structuredContent: { structuredData: true, assetDetails: data },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error fetching asset details: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
  // Register asset search widget
  const assetSearchResourceUri = 'ui://asset/asset-search.html';
  registerWidget(server, assets, {
    name: 'asset-search-widget',
    htmlPath: '/widgets/asset-search.html',
    resourceUri: assetSearchResourceUri,
    description: 'Interactive asset search results UI widget',
  });

  // Get verified asset(s) by name
  server.registerTool(
    'pera_verified_assets_search',
    {
      description: 'Search PeraWallet verified Algorand asset(s) by asset name, unit name, or creator address',
      inputSchema: {
        query: z.string().min(1).describe('Asset name, unit name, or creator address to search for'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: assetSearchResourceUri },
        'ui/resourceUri': assetSearchResourceUri,
      },
    },
    async ({ query, pageToken }) => {
      try {
        let assets: any[] = [];

        // Try searching by asset name
        assets = await getAssetsByName(query, env);

        // If not found, try by unit name
        if (!assets || assets.length === 0) {
          assets = await getAssetsByUnitName(query, env);
        }

        // If still not found, try by creator address
        if (!assets || assets.length === 0) {
          assets = await getAssetsByCreatorAddress(query, env);
        }

        // Filter out nulls (if any)
        const filteredAssets = (assets || []).filter(Boolean);

        if (filteredAssets.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `No verified assets found for: ${query}`
            }]
          };
        }

        // Paginate for widget
        const perPage = 10;
        const pageNum = pageToken ? (() => {
          try { return Number.parseInt(atob(pageToken).replace('page_', '')) || 1; } catch { return 1; }
        })() : 1;
        const startIdx = (pageNum - 1) * perPage;
        const endIdx = startIdx + perPage;
        const paginatedAssets = filteredAssets.slice(startIdx, endIdx);
        const totalPages = Math.ceil(filteredAssets.length / perPage);

        const searchResults = {
          query,
          assets: paginatedAssets,
          totalResults: filteredAssets.length,
          pagination: filteredAssets.length > perPage ? {
            currentPage: pageNum,
            totalPages,
            hasNextPage: endIdx < filteredAssets.length,
            hasPrevPage: pageNum > 1,
          } : undefined,
        };

        const textResponse = ResponseProcessor.processResponse(filteredAssets, pageToken);
        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textResponse.content[0].text) }],
          structuredContent: { structuredData: true, searchResults },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error searching verified asset(s): ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
