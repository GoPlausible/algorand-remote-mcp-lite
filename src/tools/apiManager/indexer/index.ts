/**
 * Indexer API Manager
 * Exports and registers all Algorand indexer API tools
 */
import type { Env } from '../../../types';
import { registerIndexerAccountTools } from './account';
import { registerIndexerApplicationTools } from './application';
import { registerIndexerAssetTools } from './asset';
import { registerIndexerTransactionTools } from './transaction';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { type AssetsBinding, registerWidget } from '../../../ui/widgetManager';
import { z } from 'zod';
import { ResponseProcessor } from '../../../utils';
/**
 * Register all indexer API tools to the MCP server
 */
export function registerIndexerApiTools(server: McpServer, env: Env, assets?: AssetsBinding): void {
  registerIndexerAccountTools(server, env, assets);
  // registerIndexerApplicationTools(server, env);
  registerIndexerAssetTools(server, env, assets);
  registerIndexerTransactionTools(server, env, assets);

  // Register indexer search widget
  const indexerSearchResourceUri = 'ui://indexer/indexer-search.html';
  registerWidget(server, assets, {
    name: 'indexer-search-widget',
    htmlPath: '/widgets/indexer-search.html',
    resourceUri: indexerSearchResourceUri,
    description: 'Generic indexer search results table UI widget',
  });

  // Algorand indexer search tool
  registerAppTool(server,
    'indexer_search',
    {
      description: 'Search the Algorand indexer for accounts, transactions, assets, or applications',
      inputSchema: {
        type: z.enum(['accounts', 'transactions', 'assets', 'applications']).describe('Type of entity to search'),
        query: z.record(z.string(), z.any()).describe('Query parameters'),
        limit: z.number().int().min(1).max(1000).default(100).describe('Max number of results'),
        pageToken: z.string().optional().describe('Pagination token for paginated results')
      },
      _meta: {
        ui: { resourceUri: indexerSearchResourceUri },
      },
    },
    async ({ type, query, limit, pageToken }) => {

      if (!env.ALGORAND_INDEXER) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Algorand indexer URL not configured'
          }]
        };
      }

      try {
        // Build the indexer URL
        const baseUrl = env.ALGORAND_INDEXER;
        let url = `${baseUrl}/v2/${type}`;

        // Add query parameters
        const queryParams = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });

        // Add limit parameter
        queryParams.append('limit', String(limit));

        // Append query string
        if (queryParams.toString()) {
          url += '?' + queryParams.toString();
        }

        // Make the request
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Indexer request failed with status: ${response.status}`);
        }

        const data: any = await response.json();

        // Extract results array based on type
        const results = data[type] || data.accounts || data.transactions || data.assets || data.applications || [];

        let textContent: string;
        try {
          const textResponse = ResponseProcessor.processResponse(data, pageToken);
          textContent = textResponse?.content?.[0]?.text ?? JSON.stringify({ type, resultCount: results.length });
        } catch {
          textContent = JSON.stringify({ type, resultCount: results.length });
        }

        return {
          content: [{ type: 'text' as const, text: textContent }],
          structuredContent: {
            indexerSearch: {
              type,
              results,
              totalResults: results.length,
              'next-token': data['next-token'] || null,
              query,
            }
          },
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Indexer search error: ${error.message || 'Unknown error'}`
          }]
        };
      }
    }
  );
}
