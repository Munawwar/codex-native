import { run } from "@openai/agents";
import type { AgentWorkflowConfig, CoordinatorInput } from "./types.js";
import type { WorkerOutcome } from "../merge/types.js";
import { createCoordinatorAgent } from "./coordinator-agent.js";
import { createWorkerAgent, selectWorkerModel, formatWorkerInput } from "./worker-agent.js";
import { createReviewerAgent, formatReviewerInput } from "./reviewer-agent.js";
import { logInfo } from "../merge/logging.js";

const OPEN_CODE_SEVERITY_THRESHOLD = 1200;

/**
 * Agent workflow orchestrator using @openai/agents SDK.
 * Drives: Coordinator → Worker(s) → Reviewer pipeline.
 */
export class AgentWorkflowOrchestrator {
  constructor(private readonly config: AgentWorkflowConfig) {}

  async execute(input: CoordinatorInput): Promise<{
    success: boolean;
    outcomes: WorkerOutcome[];
    coordinatorPlan: string | null;
    transcript: string;
  }> {
    logInfo("agent", "Starting agent-based merge workflow");

    // Phase 1: Coordinator plans global strategy
    const coordinatorPlan = await this.runCoordinatorPhase(input);

    // Phase 2: Workers resolve individual conflicts
    const workerOutcomes = await this.runWorkerPhase(input.conflicts, coordinatorPlan);

    // Phase 3: Reviewer validates overall outcome
    const reviewerSummary = await this.runReviewerPhase(workerOutcomes, input.remoteComparison);

    const success = workerOutcomes.every((o) => o.success);
    const transcript = this.generateTranscript(coordinatorPlan, workerOutcomes, reviewerSummary);

    return {
      success,
      outcomes: workerOutcomes,
      coordinatorPlan,
      transcript,
    };
  }

  private async runCoordinatorPhase(input: CoordinatorInput): Promise<string | null> {
    logInfo("coordinator", "Running coordinator agent...");

    const { agent } = createCoordinatorAgent({
      workingDirectory: this.config.workingDirectory,
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      sandboxMode: this.config.sandboxMode,
      skipGitRepoCheck: this.config.skipGitRepoCheck,
      model: this.config.coordinatorModel,
    });

    const result = await run(agent, JSON.stringify(input));
    return result?.finalOutput ?? null;
  }

  private async runWorkerPhase(
    conflicts: CoordinatorInput["conflicts"],
    coordinatorPlan: string | null,
  ): Promise<WorkerOutcome[]> {
    logInfo("worker", `Processing ${conflicts.length} conflicts...`);

    const outcomes: WorkerOutcome[] = [];
    for (const conflict of conflicts) {
      const model = selectWorkerModel(conflict, {
        defaultModel: this.config.workerModel,
        highReasoningModel: this.config.workerModelHigh,
        lowReasoningModel: this.config.workerModelLow,
      });

      const { agent } = createWorkerAgent({
        workingDirectory: this.config.workingDirectory,
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        sandboxMode: this.config.sandboxMode,
        skipGitRepoCheck: this.config.skipGitRepoCheck,
        model,
        conflictPath: conflict.path,
      });

      try {
        const workerPrompt = formatWorkerInput({ conflict, coordinatorPlan, remoteInfo: null });
        const result = await run(agent, workerPrompt);

        if (!result || !result.finalOutput) {
          throw new Error("Worker produced no output");
        }

        outcomes.push({
          path: conflict.path,
          success: true,
          summary: result.finalOutput,
        });
      } catch (error: any) {
        outcomes.push({
          path: conflict.path,
          success: false,
          error: error?.message ?? "Unknown worker error",
        });
      }
    }

    return outcomes;
  }

  private async runReviewerPhase(
    outcomes: WorkerOutcome[],
    remoteComparison: CoordinatorInput["remoteComparison"],
  ): Promise<string | null> {
    logInfo("reviewer", "Running reviewer agent...");

    const { agent } = createReviewerAgent({
      workingDirectory: this.config.workingDirectory,
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      sandboxMode: this.config.sandboxMode,
      skipGitRepoCheck: this.config.skipGitRepoCheck,
      model: this.config.reviewerModel,
    });

    const reviewerPrompt = formatReviewerInput({ outcomes, remoteComparison: remoteComparison ?? null });
    const result = await run(agent, reviewerPrompt);

    return result?.finalOutput ?? null;
  }

  private generateTranscript(
    coordinatorPlan: string | null,
    outcomes: WorkerOutcome[],
    reviewerSummary: string | null,
  ): string {
    const parts: string[] = [];

    parts.push("## Coordinator Plan\n");
    parts.push(coordinatorPlan ? coordinatorPlan.slice(0, 500) : "<no plan generated>");

    parts.push("\n\n## Worker Outcomes\n");
    for (const outcome of outcomes) {
      parts.push(`- ${outcome.path}: ${outcome.success ? "✓" : "✗"}`);
      if (outcome.summary) parts.push(` ${outcome.summary.slice(0, 100)}`);
      if (outcome.error) parts.push(` ERROR: ${outcome.error}`);
      parts.push("\n");
    }

    parts.push("\n## Reviewer Summary\n");
    parts.push(reviewerSummary ? reviewerSummary.slice(0, 500) : "<no summary>");

    return parts.join("");
  }
}
