/**
 * Wallet Manager for Algorand Remote MCP
 * Provides tool-based access to wallet and account information
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import { ResponseProcessor } from '../utils';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { Env, Props /* , VaultResponse */ } from '../types';
import { type AssetsBinding, registerWidget } from '../ui/widgetManager';
import {
  createKeypair,
  getPublicKey,
  getUserAddress,
  /* ensureUserAccount, */
  deleteKeypair,
  deleteEntity,
  createNewEntity
} from '../utils/vaultManager';
// import { log } from 'console';
// import { email } from 'zod/v4';

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
 * Get account from mnemonic 
 */
// function getAccountFromMnemonic(mnemonic: string | undefined): algosdk.Account | null {
//   if (!mnemonic) {
//     console.error('No active agent wallet configured');
//     return null;
//   }

//   try {
//     return algosdk.mnemonicToSecretKey(mnemonic);
//   } catch (error) {
//     console.error('Invalid mnemonic:', error);
//     return null;
//   }
// }

/**
 * Register wallet management tools to the MCP server
 */
export async function registerWalletTools(server: McpServer, env: Env, props: Props, assets?: AssetsBinding): Promise<void> {
  console.log('Registering wallet tools for Algorand Remote MCP');
  if (!props.email || !props.provider) {
    throw new Error('Email and provider must be provided in props');
  }

  // Register wallet card widget resource
  const walletCardResourceUri = 'ui://wallet/wallet-card.html';
  registerWidget(server, assets, {
    name: 'wallet-card-widget',
    htmlPath: '/widgets/wallet-card.html',
    resourceUri: walletCardResourceUri,
    description: 'Interactive wallet card UI widget',
  });

  // Register wallet reset card widget resource
  const walletResetCardResourceUri = 'ui://wallet/wallet-reset-card.html';
  registerWidget(server, assets, {
    name: 'wallet-reset-card-widget',
    htmlPath: '/widgets/wallet-reset-card.html',
    resourceUri: walletResetCardResourceUri,
    description: 'Wallet account reset confirmation card with new address and copy button',
  });

  // Register wallet role card widget resource
  const walletRoleCardResourceUri = 'ui://wallet/wallet-role-card.html';
  registerWidget(server, assets, {
    name: 'wallet-role-card-widget',
    htmlPath: '/widgets/wallet-role-card.html',
    resourceUri: walletRoleCardResourceUri,
    description: 'Vault Role ID widget with masked display, reveal toggle, copy button, and security warnings',
  });

  // Register asset portfolio widget resource
  const assetPortfolioResourceUri = 'ui://wallet/asset-portfolio.html';
  registerWidget(server, assets, {
    name: 'asset-portfolio-widget',
    htmlPath: '/widgets/asset-portfolio.html',
    resourceUri: assetPortfolioResourceUri,
    description: 'Interactive asset portfolio grid UI widget',
  });
  
  // Ensure user has a vault-based account 
  // try {
  //   const accType = await ensureUserAccount(env, props.email, props.provider || 'google');
  //   console.log(`User has a ${accType}-based account`);
  // } catch (error: any) {
  //   throw new Error(`Failed to ensure user account: ${error.message || 'Unknown error'}`);
  // }

  //Reset wallet account
  registerAppTool(
    server,
    'wallet_reset_account',
    {
      description: 'Reset the wallet account for the configured user. CAUTION: This will delete existing keys and create new ones. Warn user before proceeding.',
      _meta: {
        ui: { resourceUri: walletResetCardResourceUri },
      },
    },
    async () => {
      try {
        const publicKeyResult = await getPublicKey(env, props.email, props.provider);
        let providerEmail = `${props.provider}--${props.email}`
        let entityId: string | null = await env.VAULT_ENTITIES.get(providerEmail);
        let providerEntity : string | null =  `${props.provider}--${entityId}`;
        console.log(`Entity ID for ${providerEmail} from KV store:`, providerEntity);
        let roleId = null;
        if (!!entityId) {
          console.log(`Fetching role ID from KV for entity ${entityId}`);
          providerEntity = `${props.provider}--${entityId}`
          roleId = await env.VAULT_ENTITIES.get(providerEntity);
          console.log(`Role ID for ${entityId} from KV store:`, roleId);
        }
        if (!roleId || !entityId) {
          console.log(`provider: ${props.provider}, email: ${props.email}, clientId: ${props.clientId}, userId: ${props.id}`);
          throw new Error('Role or entity ID not found in KV store');
        }

        if (publicKeyResult.success && !publicKeyResult.error) {
          // For vault-based accounts, create a new keypair in the vault
          console.log('Creating new vault-based keypair for user:', props.email);

          // Delete existing keypair if it exists
          // Note: This would require a delete endpoint in the vault worker

          // Create new keypair
          await deleteKeypair(env, props.email, props.provider);

          await deleteEntity(env, props.email, entityId, roleId, props.provider);
          console.log(`Deleted entity and role for ${props.email} with ID ${entityId}`);

          providerEmail = `${props.provider}--${props.email}`
          providerEntity = `${props.provider}--${entityId}`
          await env.VAULT_ENTITIES.delete(providerEmail);
          console.log(`Deleted entity ID for ${providerEmail} from KV store`);
          await env.VAULT_ENTITIES.delete(providerEntity);
          console.log(`Deleted entity ID ${providerEntity} from KV store`);
          console.log(`Cleared public key cache for user: ${props.email}`);
          const entityResult = await createNewEntity(env, props.email, props.provider);
          console.log(`New entity created: ${entityResult}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          const keypairResult = await createKeypair(env, props.email, props.provider);

          if (!keypairResult.success) {
            throw new Error(keypairResult.error || 'Failed to create keypair in vault');
          }
          console.log(`New keypair created: ${keypairResult}`);
          // Get the address from the public key
          console.log(`Getting public key for ${props.email} with provider ${props.provider}`);

          const newPublicKeyResult = await getPublicKey(env, props.email, props.provider);

          if (!newPublicKeyResult.success || !newPublicKeyResult.publicKey) {
            throw new Error(newPublicKeyResult.error || 'Failed to get public key from vault');
          }
          console.log(`Public key for ${props.email}: ${newPublicKeyResult.publicKey}`);

          // Convert the public key to an Algorand address
          const publicKeyBuffer = Buffer.from(newPublicKeyResult.publicKey, 'base64');
          const address = algosdk.encodeAddress(publicKeyBuffer);
          providerEmail = `${props.provider}--${props.email}`
          entityId = await env.VAULT_ENTITIES?.get(providerEmail);
          providerEntity = `${props.provider}--${entityId}`
          console.log(`Entity ID for ${providerEmail} from KV store:`, entityId);
          if (!entityId) {
            throw new Error(`No entity ID found for ${providerEmail}`);
          }
          console.log(`Fetching role ID from KV for entity ${providerEntity}`);
          roleId = await env.VAULT_ENTITIES?.get(providerEntity);
          console.log(`Role ID for ${providerEntity} from KV store:`, roleId);
          if (!roleId) {
            throw new Error(`No Role ID found for entity: ${providerEntity}`);
          }
          const resetResult = { address, user: props.email, provider: props.provider };
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(resetResult, null, 2) }],
            structuredContent: { resetResult },
          };
        }
        throw new Error('No active agent wallet configured');
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Failed to reset wallet account: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
  
  // // Get wallet role UUID
  registerAppTool(
    server,
    'wallet_get_role',
    {
      description: 'Get the role UUID for the configured wallet to be used to login into Hashicorp Vault with OIDC. This is a very sensitive piece of information. Always protect it and avoid sharing it!',
      _meta: {
        ui: { resourceUri: walletRoleCardResourceUri },
      },
    },
    async () => {
      try {
        let providerEmail = `${props.provider}--${props.email}`
        const entityId = await env.VAULT_ENTITIES?.get(providerEmail);
        const providerEntity = `${props.provider}--${entityId}`
        console.log(`Entity ID for ${providerEmail} from KV store:`, providerEntity);
        let roleId = null;
        if (entityId) {
          console.log(`Fetching role ID from KV for entity ${providerEntity}`);
          roleId = await env.VAULT_ENTITIES?.get(providerEntity);
          console.log(`Role ID for ${providerEntity} from KV store:`, roleId);
        }
        if (!entityId) {
          return {
            content: [{
              type: 'text',
              text: 'No active agent wallet configured'
            }]
          };
        }

        const roleData = { role: roleId, user: props.email, provider: props.provider };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(roleData, null, 2) }],
          structuredContent: { roleData },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Failed to get address: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Get wallet account information (with MCP Apps UI)
  registerAppTool(
    server,
    'wallet_get_info',
    {
      description: 'Get the account information for the configured wallet. Always use algorand_mcp_skill tool (or algorand_demo_skill tool for a guided demo) at the start of each session to obtain required skill on how to operate and interact with this MCP service!',
      inputSchema: {
        pageToken: z.string().optional().describe('Pagination token for paginated results'),
      },
      _meta: {
        ui: { resourceUri: walletCardResourceUri },
      },
    },
    async ({ pageToken }) => {
      if (!env.ALGORAND_ALGOD) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Algorand node URL not configured'
          }]
        };
      }
      let providerEmail = `${props.provider}--${props.email}`
      const entityId = await env.VAULT_ENTITIES?.get(providerEmail);
      let providerEntity = `${props.provider}--${entityId}`
      console.log(`Entity ID for ${providerEmail} from KV store:`, providerEntity);

      try {
        // Get address using the unified approach
        const address = await getUserAddress(env, props.email, props.provider);

        if (!address) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No active agent wallet configured'
            }]
          };
        }

        // Create algod client
        const algodClient = createAlgoClient(env.ALGORAND_ALGOD, env.ALGORAND_TOKEN || '');
        if (!algodClient) {
          throw new Error('Failed to create Algorand client');
        }

        // Get account information
        const accountInfo = await algodClient.accountInformation(address).do();
        const pkBytes = algosdk.decodeAddress(address).publicKey;
        const pk = Buffer.from(pkBytes).toString('base64');

        // Sanitize assets to convert BigInt values to Numbers for JSON serialization
        const sanitizedAssets = (accountInfo.assets || []).map((a: any) => ({
          assetId: Number(a.assetId ?? a['asset-id']),
          amount: Number(a.amount),
        }));

        const walletData = {
          accounts: [{
            address,
            amount: Number(accountInfo.amount),
            assets: sanitizedAssets,
            user: props.email,
            provider: props.provider,
            publickey: pk
          }]
        };

        // Return both text fallback and structured content for UI
        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(walletData, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ address, amount: walletData.accounts[0]?.amount });
        } catch {
          textContent = JSON.stringify({ address, amount: walletData.accounts[0]?.amount });
        }
        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { ...walletData },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to get account info: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Get wallet assets
  registerAppTool(
    server,
    'wallet_get_assets',
    {
      description: 'Get the assets for the configured wallet',
      inputSchema: {
        pageToken: z.string().optional().describe('Pagination token for paginated results'),
      },
      _meta: {
        ui: { resourceUri: assetPortfolioResourceUri },
      },
    },
    async ({ pageToken }) => {
      if (!env.ALGORAND_ALGOD) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Algorand node URL not configured'
          }]
        };
      }

      try {
        // Get address using the unified approach
        const address = await getUserAddress(env, props.email, props.provider);

        if (!address) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No active agent wallet configured'
            }]
          };
        }

        // Create algod client
        const algodClient = createAlgoClient(env.ALGORAND_ALGOD, env.ALGORAND_TOKEN || '');
        if (!algodClient) {
          throw new Error('Failed to create Algorand client');
        }

        // Get account information
        const accountInfo = await algodClient.accountInformation(address).do();

        const allAssets = (accountInfo.assets || []).map((a: any) => ({
          assetId: Number(a.assetId ?? a['asset-id']),
          amount: Number(a.amount),
          isFrozen: Boolean(a.isFrozen ?? a['is-frozen']),
        }));

        // Paginate for widget
        const perPage = 10;
        const pageNum = pageToken ? (() => {
          try { return Number.parseInt(atob(pageToken).replace('page_', '')) || 1; } catch { return 1; }
        })() : 1;
        const startIdx = (pageNum - 1) * perPage;
        const endIdx = startIdx + perPage;
        const paginatedAssets = allAssets.slice(startIdx, endIdx);
        const totalPages = Math.ceil(allAssets.length / perPage);

        const assetPortfolio = {
          address,
          user: props.email,
          provider: props.provider,
          assets: paginatedAssets,
          totalAssets: allAssets.length,
          pagination: allAssets.length > perPage ? {
            currentPage: pageNum,
            totalPages,
            hasNextPage: endIdx < allAssets.length,
            hasPrevPage: pageNum > 1,
          } : undefined,
        };

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse({
            assets: allAssets,
            user: props.email,
            provider: props.provider,
          }, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ assetCount: allAssets.length });
        } catch {
          textContent = JSON.stringify({ assetCount: allAssets.length });
        }

        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: { assetPortfolio },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to get asset info: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Logout from OAuth provider
  // server.tool(
  //   'wallet_logout',
  //   'Logout from the OAuth provider and clear authentication cookies',
  //   {},
  //   async () => {
  //     try {
  //       // Build the logout URL with the base URL from the environment or a default
  //       const baseUrl = new URL('https://lite.goplausible.xyz');
  //       const logoutUrl = new URL('/logout', baseUrl.origin);
  //       console.log(`Calling Logout URL: ${logoutUrl.toString()}`);

  //       // Add query parameters - always revoke token if available
  //       if (props?.accessToken && props?.provider) {
  //         logoutUrl.searchParams.set('token', props.accessToken);
  //         logoutUrl.searchParams.set('email', props.email || '');
  //         logoutUrl.searchParams.set('clientId', props.clientId || '');
  //         logoutUrl.searchParams.set('userId', props.id || '');
  //         logoutUrl.searchParams.set('provider', props.provider);
  //         console.log(`Including token and provider in logout request: provider=${props.provider}, token length=${props.accessToken.length}`);
  //       } else {
  //         console.log('No token or provider available for logout request');
  //       }

  //       console.log(`Calling logout endpoint: ${logoutUrl.toString()}`);

  //       // Call the logout endpoint
  //       const response = await fetch(logoutUrl.toString(), {
  //         method: 'GET'
  //       });

  //       if (!response.ok) {
  //         const errorText = await response.text();
  //         console.error(`Logout failed with status: ${response.status}, response: ${errorText}`);
  //         throw new Error(`Logout failed with status: ${response.status}`);
  //       }

  //       // Parse the response to get any additional information
  //       const responseData = await response.json();
  //       console.log('Logout response:', responseData);


  //       // Return response with clear instructions for the client
  //       return ResponseProcessor.processResponse({
  //         success: true,
  //         message: 'Successfully logged out. You will need to re-authenticate on your next request.',
  //         user: props.email,
  //         provider: props.provider,
  //         forceReauthentication: true
  //       });
  //     } catch (error: any) {
  //       console.error('Error during logout:', error);
  //       return {
  //         content: [{
  //           type: 'text',
  //           text: `Error during logout: ${error.message || 'Unknown error'}`
  //         }]
  //       };
  //     }
  //   }
  // );
}
