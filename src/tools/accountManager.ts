/**
 * Account Manager for Algorand Remote MCP
 * Handles account-related operations on the Algorand blockchain
 */

import * as algosdk from 'algosdk';
import { z } from 'zod';
import { ResponseProcessor } from '../utils';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, Props } from '../types';
import { type AssetsBinding, registerWidget } from '../ui/widgetManager';

/**
 * Register account management tools to the MCP server
 */
export function registerAccountTools(server: McpServer, env: Env, props: Props, assets?: AssetsBinding): void {

  // Register balance card widget
  const balanceCardResourceUri = 'ui://account/balance-card.html';
  registerWidget(server, assets, {
    name: 'balance-card-widget',
    htmlPath: '/widgets/balance-card.html',
    resourceUri: balanceCardResourceUri,
    description: 'Account balance card showing address, balance, and MBR',
  });

  // Check account balance
  server.registerTool(
    'sdk_check_account_balance',
    {
      description: 'Check the balance of an Algorand account',
      inputSchema: {
        address: z.string()
      },
      _meta: {
        ui: { resourceUri: balanceCardResourceUri },
        'ui/resourceUri': balanceCardResourceUri,
      },
    },
    async ({ address }) => {
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
        const algodClient = new algosdk.Algodv2(env.ALGORAND_TOKEN || '', env.ALGORAND_ALGOD, '');

        // Get account information
        const accountInfo = await algodClient.accountInformation(address).do();

        // Convert from microAlgos to Algos
        const balance = Number(accountInfo.amount) / 1000000;

        const balanceData = {
          address,
          balance,
          microAlgos: Number(accountInfo.amount),
          minBalance: Number(accountInfo.minBalance)
        };

        const textResponse = ResponseProcessor.processResponse(balanceData);
        return {
          content: [{ type: 'text' as const, text: ResponseProcessor.withStructuredFlag(textResponse.content[0].text) }],
          structuredContent: { structuredData: true, balanceData },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error checking balance: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
