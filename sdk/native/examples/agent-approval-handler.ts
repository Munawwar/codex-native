#!/usr/bin/env tsx
/**
 * Agent-to-Agent Approval Handler Example
 *
 * This demonstrates how a manager agent can approve requests from Claude Code
 * worker using streaming JSON input/output for bidirectional communication.
 *
 * Flow:
 * 1. Manager sends task to Claude via stdin (stream-json)
 * 2. Claude processes and sends events via stdout (stream-json)
 * 3. When Claude needs approval, it emits an approval request event
 * 4. Manager receives event, makes decision, sends approval back via stdin
 * 5. Claude continues execution
 *
 * Usage:
 *   tsx examples/agent-approval-handler.ts "Run npm install"
 */

import { spawn } from "child_process";
import * as readline from "readline";

interface ApprovalRequest {
  type: "approval_request";
  request: {
    type: string; // "command_execution", "file_write", etc.
    details: any;
  };
}

interface UserMessage {
  type: "user";
  message: {
    role: "user";
    content: Array<{ type: "text"; text: string }>;
  };
}

interface AssistantMessage {
  type: "assistant";
  message: {
    role: "assistant";
    content: string;
  };
}

interface StreamEvent {
  type: string;
  [key: string]: any;
}

/**
 * Manager agent that delegates to Claude and handles approval requests
 */
class ManagerAgent {
  private claudeProcess: ReturnType<typeof spawn> | null = null;
  private rl: readline.Interface | null = null;

  /**
   * Approve or deny a request based on manager's policy
   */
  async reviewApprovalRequest(request: ApprovalRequest): Promise<boolean> {
    console.log("\n[MANAGER] Approval request received:");
    console.log(JSON.stringify(request.request, null, 2));

    // Manager's approval logic
    if (request.request.type === "command_execution") {
      const command = request.request.details?.command || "";

      // Example policy: auto-approve safe commands, deny dangerous ones
      const safeCommands = ["npm install", "npm test", "git status", "ls", "pwd"];
      const dangerousCommands = ["rm -rf", "sudo", "curl", "wget"];

      if (dangerousCommands.some(cmd => command.includes(cmd))) {
        console.log("[MANAGER] ❌ DENIED - Dangerous command detected");
        return false;
      }

      if (safeCommands.some(cmd => command.includes(cmd))) {
        console.log("[MANAGER] ✅ APPROVED - Safe command");
        return true;
      }

      // Default: ask for manual approval in a real implementation
      console.log("[MANAGER] ⚠️  REVIEW NEEDED - Manual approval required");
      return false; // Conservative default
    }

    return false;
  }

  /**
   * Delegate a task to Claude with approval handling
   */
  async delegateWithApproval(task: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("[MANAGER] Starting Claude worker with approval handling...\n");

      // Spawn Claude with streaming JSON I/O
      this.claudeProcess = spawn(
        "claude",
        [
          "-p",
          "--output-format", "stream-json",
          "--input-format", "stream-json",
          "--verbose"
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      if (!this.claudeProcess.stdin || !this.claudeProcess.stdout) {
        reject(new Error("Failed to create Claude process"));
        return;
      }

      // Setup line-by-line reading of stdout
      this.rl = readline.createInterface({
        input: this.claudeProcess.stdout,
        crlfDelay: Infinity,
      });

      // Send initial task
      const initialMessage: UserMessage = {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: task }],
        },
      };

      this.claudeProcess.stdin.write(JSON.stringify(initialMessage) + "\n");

      // Process events from Claude
      this.rl.on("line", async (line) => {
        try {
          const event: StreamEvent = JSON.parse(line);

          // Log all events for debugging
          console.log(`[CLAUDE EVENT] ${event.type}`);

          // Handle different event types
          if (event.type === "approval_request") {
            const approved = await this.reviewApprovalRequest(event as ApprovalRequest);

            // Send approval response back to Claude
            const response = {
              type: "approval_response",
              approved,
            };

            this.claudeProcess!.stdin!.write(JSON.stringify(response) + "\n");
          } else if (event.type === "assistant") {
            const msg = event as AssistantMessage;
            console.log("\n[CLAUDE RESPONSE]:", msg.message.content);
          } else if (event.type === "result") {
            console.log("\n[MANAGER] Task completed");
            console.log("Result:", event);
            this.cleanup();
            resolve();
          } else if (event.type === "error") {
            console.error("\n[MANAGER] Error from Claude:", event);
            this.cleanup();
            reject(new Error(event.message || "Unknown error"));
          }
        } catch (e) {
          console.error("Failed to parse event:", line, e);
        }
      });

      this.claudeProcess.on("error", (error) => {
        console.error("[MANAGER] Process error:", error);
        this.cleanup();
        reject(error);
      });

      this.claudeProcess.on("close", (code) => {
        console.log(`[MANAGER] Claude process exited with code ${code}`);
        this.cleanup();
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}`));
        } else {
          resolve();
        }
      });

      // Handle stderr
      if (this.claudeProcess.stderr) {
        this.claudeProcess.stderr.on("data", (data) => {
          console.error("[CLAUDE STDERR]:", data.toString());
        });
      }
    });
  }

  private cleanup() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.claudeProcess) {
      this.claudeProcess.kill();
      this.claudeProcess = null;
    }
  }
}

// CLI entry point
const task = process.argv[2];

if (!task) {
  console.error("Usage: tsx examples/agent-approval-handler.ts \"Your task\"");
  console.error("");
  console.error("Example:");
  console.error('  tsx examples/agent-approval-handler.ts "Run npm install"');
  process.exit(1);
}

const manager = new ManagerAgent();
manager
  .delegateWithApproval(task)
  .then(() => {
    console.log("\n[MANAGER] Delegation complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[MANAGER] Delegation failed:", error);
    process.exit(1);
  });
