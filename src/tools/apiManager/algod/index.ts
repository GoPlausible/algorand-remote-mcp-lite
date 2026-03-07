/**
 * Algod API Manager
 * Exports and registers all Algorand node API tools
 */
import type { Env } from '../../../types';
import { registerAccountApiTools } from './account';
import { registerApplicationApiTools } from './application';
import { registerAssetApiTools } from './asset';
import { registerTransactionApiTools } from './transaction';
import { registerStatsTools } from './stats';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AssetsBinding } from '../../../ui/widgetManager';

/**
 * Register all Algorand node API tools to the MCP server
 */
export function registerAlgodApiTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  registerAccountApiTools(server, env, assets);
  // registerApplicationApiTools(server, env);
  registerAssetApiTools(server, env, assets);
  registerTransactionApiTools(server, env);
  registerStatsTools(server, env, assets);
}
