import { Agent, Runner, type Model } from "@openai/agents";
import { CodexProvider } from "@codex-native/sdk";
import type { AgentWorkflowConfig, CoordinatorInput, CoordinatorOutput, WorkerOutput, ReviewerOutput } from "./types.js";
import type { WorkerOutcome, ConflictContext } from "../merge/types.js";
import { buildCoordinatorPrompt, buildReviewerPrompt, buildWorkerPrompt } from "../merge/prompts.js";
import {
  DEFAULT_COORDINATOR_MODEL,
  DEFAULT_REVIEWER_MODEL,
  DEFAULT_WORKER_MODEL,
} from "../merge/constants.js";
import { selectWorkerModel } from "./worker-agent.js";
import { runOpenCodeResolution } from "./opencode-wrapper.js";
import { ApprovalSupervisor } from "../merge/supervisor.js";

const OPEN_CODE_SEVERITY_THRESHOLD = 1200;

/**
 * Agent workflow orchestrator:
 * Coordinator → Worker(s) (simple vs complex) → Reviewer.
 * When config.dryRun is true, produces simulated outputs without remote calls.
 */
export class AgentWorkflowOrchestrator {
  private readonly runner: Runner;
  private readonly supervisor: ApprovalSupervisor;

  constructor(private readonly config: AgentWorkflowConfig) {
    const provider = new CodexProvider({
      defaultModel: config.workerModel ?? DEFAULT_WORKER_MODEL,
      workingDirectory: config.workingDirectory,
      sandboxMode: config.sandboxMode,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      skipGitRepoCheck: config.skipGitRepoCheck ?? false,
    });
    this.runner = new Runner({ modelProvider: provider });

    const codex = new CodexProvider({
      defaultModel: config.supervisorModel ?? DEFAULT_COORDINATOR_MODEL,
      workingDirectory: config.workingDirectory,
      sandboxMode: config.sandboxMode,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      skipGitRepoCheck: config.skipGitRepoCheck ?? false,
    }).getCodex();

    this.supervisor = new ApprovalSupervisor(
      codex,
      {
        model: config.supervisorModel ?? DEFAULT_COORDINATOR_MODEL,
        workingDirectory: config.workingDirectory,
        sandboxMode: config.sandboxMode,
      },
      () => null,
    );
  }

  async execute(input: CoordinatorInput): Promise<{
    success: boolean;
    outcomes: WorkerOutcome[];
    summary: string | null;
  }> {
    if (this.config.dryRun) {
      return this.simulate(input);
    }

    const coordinator = new Agent<CoordinatorInput, CoordinatorOutput>({
      name: "MergeCoordinator",
      model: this.modelOrDefault(this.config.coordinatorModel, DEFAULT_COORDINATOR_MODEL),
      instructions: buildCoordinatorPrompt(input),
    });

    const coordResult = await this.runner.run(coordinator, input);
    const plan = (coordResult.finalOutput && typeof coordResult.finalOutput === "object"
      ? (coordResult.finalOutput as CoordinatorOutput).plan
      : coordResult.text || null) ?? null;

    const outcomes: WorkerOutcome[] = [];
    for (const conflict of input.conflicts) {
      const severity = this.computeSeverity(conflict);
      if (severity >= OPEN_CODE_SEVERITY_THRESHOLD) {
        const ocOutcome = await runOpenCodeResolution(conflict, {
          workingDirectory: this.config.workingDirectory,
          sandboxMode: this.config.sandboxMode,
          approvalSupervisor: this.supervisor,
          model: this.config.workerModelHigh ?? DEFAULT_WORKER_MODEL,
          baseUrl: this.config.baseUrl,
          apiKey: this.config.apiKey,
        });
        outcomes.push(ocOutcome);
        continue;
      }

      const worker = new Agent<{ conflict: ConflictContext; coordinatorPlan: string | null }, WorkerOutput>({
        name: `MergeWorker:${conflict.path}`,
        model: this.modelOrDefault(
          selectWorkerModel(conflict, {
            defaultModel: this.config.workerModel ?? DEFAULT_WORKER_MODEL,
            highReasoningModel: this.config.workerModelHigh,
            lowReasoningModel: this.config.workerModelLow,
          }),
          DEFAULT_WORKER_MODEL,
        ),
        instructions: buildWorkerPrompt(conflict, plan, {
          originRef: input.originRef,
          upstreamRef: input.upstreamRef,
        }),
      });

      const result = await this.runner.run(worker, { conflict, coordinatorPlan: plan });
      const final = result.finalOutput as WorkerOutput | string | undefined;
      outcomes.push({
        path: conflict.path,
        success: typeof final === "object" ? final.success ?? false : Boolean(result.text),
        summary: typeof final === "object" ? final.summary : result.text ?? undefined,
        error: typeof final === "object" ? final.error : undefined,
        validationStatus: typeof final === "object" ? final.validationStatus : undefined,
      });
    }

    const reviewer = new Agent<CoordinatorInput, ReviewerOutput>({
      name: "MergeReviewer",
      model: this.modelOrDefault(this.config.reviewerModel, DEFAULT_REVIEWER_MODEL),
      instructions: buildReviewerPrompt({
        status: input.statusShort,
        diffStat: input.diffStat,
        remaining: outcomes.filter((o) => !o.success).map((o) => o.path),
        workerSummaries: outcomes,
        remoteComparison: input.remoteComparison ?? null,
        validationMode: false,
      }),
    });

    const reviewResult = await this.runner.run(reviewer, input);
    const summary =
      (typeof reviewResult.finalOutput === "object"
        ? (reviewResult.finalOutput as ReviewerOutput).summary
        : reviewResult.text) ?? null;

    const success = outcomes.every((o) => o.success);
    return { success, outcomes, summary };
  }

  private simulate(input: CoordinatorInput): { success: boolean; outcomes: WorkerOutcome[]; summary: string | null } {
    const outcomes: WorkerOutcome[] = input.conflicts.map((conflict) => ({
      path: conflict.path,
      success: true,
      summary: `Simulated resolution for ${conflict.path}`,
    }));
    return {
      success: true,
      outcomes,
      summary: "Simulated reviewer summary",
    };
  }

  private modelOrDefault(model: string | undefined, fallback: string): Model {
    return (model as Model) ?? (fallback as Model);
  }

  private computeSeverity(conflict: { lineCount: number | null; conflictMarkers: number | null }): number {
    return (conflict.lineCount ?? 0) + (conflict.conflictMarkers ?? 0) * 200;
  }
}
