/**
 * Skill Resource for Algorand Remote MCP
 * Provides access to comprehensive skill definition for using algorand-remote-mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { skill } from '../../utils/Skill.js';
import type { Env, Props } from '../../types';

/**
 * Register skill resource to the MCP server
 */
export function registerSkillResource(server: McpServer, env: Env, props: Props): void {
  // Main skill resource
  server.registerResource(
    "Algorand MCP Skill",
    "algorand://remote-mcp-skill",
    {
      description: "Comprehensive skill definition for using Algorand Remote MCP tools",
      mimeType: "text/plain",
    },
    (uri) => {
      return {
        contents: [{
          uri: uri.href,
          text: skill,
        }],
      };
    },
  );
}
