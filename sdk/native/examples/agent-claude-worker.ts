#!/usr/bin/env tsx
/**
 * Claude Code CLI Delegation Example
 *
 * This example demonstrates how to delegate tasks to Claude Code via headless CLI:
 * - Send implementation tasks to Claude Code
 * - Capture session IDs for conversation tracking
 * - Resume conversations to provide follow-up instructions
 * - Iterate back-and-forth until work is complete
 *
 * This pattern can be used by agents (like diff-agent) to delegate
 * implementation work to Claude Code as a worker.
 *
 * Usage:
 *   tsx examples/agent-claude-worker.ts "Create a TypeScript function that adds two numbers"
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

interface ClaudeResponse {
  type: string;
  subtype: string;
  total_cost_usd?: number;
  is_error: boolean;
  duration_ms?: number;
  result: string;
  session_id?: string;
}

/**
 * Send a task to Claude Code CLI and get the response with session ID
 */
async function delegateToClaudeCLI(task: string, sessionId?: string): Promise<ClaudeResponse> {
  const workDir = path.join(process.cwd(), '.claude-worker');

  try {
    let command: string;

    if (sessionId) {
      // Resume existing conversation
      console.log(`\n[Resuming session ${sessionId.substring(0, 8)}...]\n`);
      command = `claude --resume ${sessionId} "${task}" --output-format json`;
    } else {
      // Start new conversation
      console.log(`\n[Starting new Claude Code session]\n`);
      command = `claude -p "${task}" --output-format json`;
    }

    const { stdout } = await execAsync(command, {
      cwd: workDir,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000
    });

    const response = JSON.parse(stdout) as ClaudeResponse;

    if (response.session_id) {
      console.log(`\n[Session ID: ${response.session_id}]`);
    }

    return response;

  } catch (error: any) {
    throw new Error(`Claude CLI failed: ${error.message}`);
  }
}

/**
 * Demonstration: Multi-turn delegation workflow
 */
async function runDelegationDemo(initialTask: string) {
  console.log('='.repeat(80));
  console.log('CLAUDE CODE CLI DELEGATION DEMO');
  console.log('='.repeat(80));

  try {
    // Step 1: Delegate initial task to Claude
    console.log('\n[Step 1: Initial Task]');
    console.log(`Task: ${initialTask}`);

    const response1 = await delegateToClaudeCLI(initialTask);

    if (response1.is_error) {
      throw new Error(`Claude returned error: ${response1.result}`);
    }

    console.log('\n[Claude Response]:');
    console.log(response1.result);

    // Step 2: Optional follow-up (could be review feedback, additional requirements, etc.)
    if (response1.session_id) {
      console.log('\n[Step 2: Follow-up Request]');
      console.log('Task: Add error handling and input validation');

      const response2 = await delegateToClaudeCLI(
        'Add error handling and input validation to the function you just created',
        response1.session_id
      );

      console.log('\n[Claude Response]:');
      console.log(response2.result);

      // Step 3: Final review/approval
      console.log('\n[Step 3: Request Code Review]');

      const response3 = await delegateToClaudeCLI(
        'Review the code for any potential issues or improvements',
        response2.session_id
      );

      console.log('\n[Claude Response]:');
      console.log(response3.result);
    }

    console.log('\n' + '='.repeat(80));
    console.log('DELEGATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n[ERROR]', error.message);
    process.exit(1);
  }
}

// CLI entry point
const task = process.argv[2];

if (!task) {
  console.error('Usage: tsx examples/agent-claude-worker.ts "Your task description"');
  console.error('');
  console.error('Example:');
  console.error('  tsx examples/agent-claude-worker.ts "Create a function that adds two numbers"');
  console.error('');
  console.error('This will:');
  console.error('  1. Delegate the initial task to Claude Code CLI');
  console.error('  2. Capture the session ID');
  console.error('  3. Send follow-up requests using the same session');
  console.error('  4. Demonstrate multi-turn conversation tracking');
  process.exit(1);
}

runDelegationDemo(task)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
