/**
 * Widget Manager for MCP Apps UI integration
 * Handles loading HTML widgets from ASSETS binding and registering them as MCP resources
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";

export type AssetsBinding = {
  fetch: (request: Request | string) => Promise<Response>;
};

export interface WidgetConfig {
  name: string;
  htmlPath: string;
  resourceUri: string;
  description: string;
  resourceDomains?: string[];
  connectDomains?: string[];
}

/**
 * Load an HTML file from the Cloudflare Workers ASSETS binding
 */
export async function loadHtml(
  assets: AssetsBinding | undefined,
  htmlPath: string,
): Promise<string> {
  if (!assets) {
    throw new Error("ASSETS binding not available");
  }

  const request = new Request(
    new URL(htmlPath, "https://assets.invalid").toString(),
  );
  const response = await assets.fetch(request);

  if (!response.ok) {
    throw new Error(`Failed to fetch widget HTML: ${response.status}`);
  }

  return await response.text();
}

/**
 * Register a widget as an MCP resource linked to a tool via resourceUri
 */
export function registerWidget(
  server: McpServer,
  assets: AssetsBinding | undefined,
  config: WidgetConfig,
): void {
  server.registerResource(
    config.name,
    config.resourceUri,
    {
      description: config.description,
      mimeType: RESOURCE_MIME_TYPE,
    },
    async (uri) => {
      const htmlContent = await loadHtml(assets, config.htmlPath);

      const content: {
        uri: string;
        mimeType: string;
        text: string;
        _meta?: { ui?: { csp?: { resourceDomains?: string[]; connectDomains?: string[] } } };
      } = {
        uri: uri.href,
        mimeType: RESOURCE_MIME_TYPE,
        text: htmlContent,
      };

      if (config.resourceDomains?.length || config.connectDomains?.length) {
        content._meta = {
          ui: {
            csp: {
              ...(config.resourceDomains?.length && { resourceDomains: config.resourceDomains }),
              ...(config.connectDomains?.length && { connectDomains: config.connectDomains }),
            },
          },
        };
      }

      return { contents: [content] };
    },
  );
}
