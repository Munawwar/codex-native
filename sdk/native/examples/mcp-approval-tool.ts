#!/usr/bin/env tsx
/**
 * MCP Approval Tool Example
 *
 * This demonstrates using an MCP tool to handle approval requests from Claude.
 * The manager agent provides an MCP server with an approval tool that Claude
 * can call when it needs permission.
 *
 * Usage:
 *   1. Start the MCP server (this script)
 *   2. Run Claude with: claude -p "task" --permission-prompt-tool mcp__manager__approve
 *
 * The MCP server provides a tool called "approve" that Claude calls when
 * it needs permission to execute commands or modify files.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Manager's approval policy
 */
function shouldApprove(request: {
  action: string;
  target: string;
  details?: any;
}): { approved: boolean; reason: string } {
  const { action, target, details } = request;

  console.error(`[MANAGER] Reviewing approval request:`, {
    action,
    target,
    details,
  });

  // Policy: Auto-approve safe operations
  const safeActions = ["read", "list", "status"];
  const dangerousActions = ["delete", "remove", "destroy"];

  if (safeActions.includes(action.toLowerCase())) {
    return { approved: true, reason: "Safe read-only operation" };
  }

  if (dangerousActions.some((d) => action.toLowerCase().includes(d))) {
    return {
      approved: false,
      reason: "Dangerous operation requires manual approval",
    };
  }

  // Policy: Auto-approve npm/pnpm install
  if (action === "execute_command") {
    const command = target;
    if (
      command.startsWith("npm install") ||
      command.startsWith("pnpm install")
    ) {
      return { approved: true, reason: "Package installation allowed" };
    }

    if (command.startsWith("npm test") || command.startsWith("pnpm test")) {
      return { approved: true, reason: "Test execution allowed" };
    }

    // Block destructive commands
    if (
      command.includes("rm -rf") ||
      command.includes("sudo") ||
      command.startsWith("curl") ||
      command.startsWith("wget")
    ) {
      return { approved: false, reason: "Potentially dangerous command" };
    }
  }

  // Policy: Auto-approve file writes to specific directories
  if (action === "write_file") {
    const allowedDirs = ["src/", "tests/", "docs/", "examples/"];
    if (allowedDirs.some((dir) => target.startsWith(dir))) {
      return { approved: true, reason: "Writing to allowed directory" };
    }

    return {
      approved: false,
      reason: "File write outside allowed directories",
    };
  }

  // Default: deny
  return { approved: false, reason: "No matching approval policy" };
}

/**
 * Create MCP server with approval tool
 */
async function createApprovalServer() {
  const server = new Server(
    {
      name: "manager-approval-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register the approval tool
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "approve",
          description:
            "Request approval from the manager agent to perform an action. Returns whether the action is approved and the reason.",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                description:
                  "The action to perform (e.g., 'execute_command', 'write_file', 'delete_file')",
              },
              target: {
                type: "string",
                description:
                  "The target of the action (e.g., command string, file path)",
              },
              details: {
                type: "object",
                description: "Additional details about the action",
              },
            },
            required: ["action", "target"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "approve") {
      const args = request.params.arguments as {
        action: string;
        target: string;
        details?: any;
      };

      const decision = shouldApprove(args);

      console.error(
        `[MANAGER] Decision: ${decision.approved ? "✅ APPROVED" : "❌ DENIED"} - ${decision.reason}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(decision, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  // Start server on stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP SERVER] Manager approval server started");
  console.error(
    "[MCP SERVER] Claude can now call the 'approve' tool for permissions"
  );
}

// Start the server
createApprovalServer().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
