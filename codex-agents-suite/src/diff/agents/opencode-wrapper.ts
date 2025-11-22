/**
 * OpenCode wrapper for complex conflicts.
 *
 * This module keeps OpenCode separate from the @openai/agents flow. It is
 * supervised by the ApprovalSupervisor to gate sensitive operations.
 */

import { Codex } from "@codex-native/sdk";
import type { ApprovalSupervisor } from "../merge/supervisor.js";
import type { ConflictContext, WorkerOutcome } from "../merge/types.js";

export interface OpenCodeOptions {
  workingDirectory: string;
  sandboxMode: string;
  approvalSupervisor: ApprovalSupervisor;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Placeholder OpenCode execution. For now, it returns a stub outcome but
 * preserves the supervision hook so approvals are still respected.
 */
export async function runOpenCodeResolution(
  conflict: ConflictContext,
  options: OpenCodeOptions,
): Promise<WorkerOutcome> {
  const codex = new Codex({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
  });
  codex.setApprovalCallback(async (req) => options.approvalSupervisor.handleApproval(req));

  // TODO: integrate real OpenCodeAgent call.
  return {
    path: conflict.path,
    success: false,
    summary: "OpenCode delegation placeholder (not yet implemented)",
    error: "opencode_not_implemented",
  };
}
