/**
 * Coordinator Agent Definition
 *
 * Plans global merge strategy using @openai/agents SDK with CodexProvider
 */

import { Agent } from "@openai/agents";
import { CodexProvider, type Codex } from "@codex-native/sdk";
import type { ApprovalSupervisor } from "../merge/supervisor.js";
import { buildCoordinatorPrompt } from "../merge/prompts.js";
import { DEFAULT_COORDINATOR_MODEL } from "../merge/constants.js";
import type { AgentConfig, AgentFactory, CoordinatorInput } from "./types.js";

/**
 * Create a Coordinator Agent using the @openai/agents framework
 */
export function createCoordinatorAgent(
  config: AgentConfig & { model?: string; approvalSupervisor?: ApprovalSupervisor | null }
): AgentFactory {
  const provider = new CodexProvider({
    defaultModel: config.model || DEFAULT_COORDINATOR_MODEL,
    workingDirectory: config.workingDirectory,
    sandboxMode: config.sandboxMode,
    approvalMode: config.approvalMode,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    skipGitRepoCheck: config.skipGitRepoCheck ?? false,
  });

  if (config.approvalSupervisor?.isAvailable?.()) {
    const codex = (provider as unknown as { getCodex?: () => Codex }).getCodex?.();
    codex?.setApprovalCallback((request) => config.approvalSupervisor!.handleApproval(request));
  }

  const codexModel = provider.getModel(config.model || DEFAULT_COORDINATOR_MODEL);

  const coordinatorAgent = new Agent({
    name: "MergeCoordinator",
    model: codexModel,
    instructions: config.coordinatorInstructions ?? `You are the Merge Conflict Coordinator agent.

Responsibilities:
1. Analyze repository state (branch, commits, conflicts, remote divergence)
2. Create structured merge plan with sequencing and cross-file coupling analysis
3. Identify which conflicts need high-reasoning models vs simple resolution
4. Provide guidance to worker agents

Important Principles:
- PREFER UPSTREAM: Align with upstream main whenever possible - accept upstream changes by default
- MAINTAIN FUNCTIONALITY: Ensure our custom functionality remains operable and supported
- MINIMALLY INVASIVE: Make the smallest changes needed to preserve our features
- When extending codex functionality, prefer adding new code to sdk/native/src/ (Rust/TypeScript)
  rather than modifying core codex files - this keeps us aligned with upstream for future merges
- If upstream changed core code, prefer their version and re-implement our features via sdk/native/src/
- Only modify core codex files when absolutely necessary for functionality

Output a structured plan with:
- Executive summary
- Per-file strategy (what to preserve, what to integrate, complexity level)
- Cross-file couplings with reasoning
- Sequencing recommendations
- Post-resolution verification steps

Be concise and actionable.`,
  });

  return {
    agent: coordinatorAgent,
    model: codexModel,
  };
}

/**
 * Helper to format coordinator input as a prompt
 */
export function formatCoordinatorInput(input: CoordinatorInput): string {
  return buildCoordinatorPrompt(input);
}
