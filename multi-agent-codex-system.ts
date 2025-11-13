/**
 * Multi-Agent Codex System - Advanced PR Reviewer & CI Checker
 *
 * This script orchestrates several specialized agents to review the current branch,
 * inspect CI health, and hand off into interactive Codex TUI sessions. It combines:
 *   1. Automated `codex.review()` runs for branch diffs
 *   2. Multi-agent analysis (intent, risk, quality, CI focus)
 *   3. GitHub PR status inspection via `gh pr view/checks`
 *   4. Thread forking so CI analysis can branch off while preserving review context
 *   5. Optional reverie lookup for prior lessons (with embedding-based re-ranking)
 *
 * Embedding Support:
 * To enable semantic re-ranking of reveries via FastEmbed, configure:
 *   config.embedder = {
 *     initOptions: { model: "BAAI/bge-large-en-v1.5" },
 *     embedRequest: { normalize: true }
 *   };
 *
 * The system will:
 * - First recall candidates with native keyword search (fast, broad)
 * - Re-rank top candidates using semantic similarity (slow, precise)
 * - Blend scores: 70% semantic + 30% keyword
 */

import * as process from "node:process";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { Agent, Runner, handoff } from "@openai/agents";
import { z } from "zod";
import {
  Codex,
  CodexProvider,
  type Thread,
  type NativeTuiExitInfo,
  fastEmbedInit,
  fastEmbedEmbed,
  type FastEmbedInitOptions,
  type FastEmbedEmbedRequest,
} from "@codex-native/sdk";

const DEFAULT_MODEL = "gpt-5-codex";
const DEFAULT_MINI_MODEL = "gpt-5-codex-mini";
const FALLBACK_BASE_BRANCH = "main";
const MAX_CONTEXT_LINES = 140;
const MAX_CONTEXT_CHARS = 4800;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MultiAgentConfig = {
  baseUrl?: string;
  apiKey?: string;
  workingDirectory: string;
  skipGitRepoCheck: boolean;
  interactive?: boolean;
  reviewBranch?: boolean;
  ciCheck?: boolean;
  reverieQuery?: string;
  model?: string;
  baseBranchOverride?: string;
  embedder?: FastEmbedConfig;
};

type FastEmbedConfig = {
  initOptions: FastEmbedInitOptions;
  embedRequest: Omit<FastEmbedEmbedRequest, "inputs" | "projectRoot">;
};

const IntentionSchema = z.object({
  category: z
    .enum(["Feature", "Refactor", "BugFix", "Performance", "Security", "DevEx", "Architecture", "Testing"])
    .describe("High-level intention category"),
  title: z.string().min(5).max(160),
  summary: z.string().min(10).max(400),
  impactScope: z.enum(["local", "module", "system"]).default("module"),
  evidence: z.array(z.string()).default([]),
});
type Intention = z.infer<typeof IntentionSchema>;
const IntentionListSchema = z.array(IntentionSchema).min(1).max(12);

const RiskSchema = z.object({
  category: z
    .enum(["Architecture", "Quality", "Security", "Performance", "Process", "Testing", "Dependency", "Regression"])
    .describe("Risk grouping"),
  title: z.string().min(5).max(140),
  likelihood: z.enum(["High", "Medium", "Low"]),
  impact: z.enum(["Critical", "High", "Medium", "Low"]),
  detectability: z.enum(["Pre-merge", "Post-merge", "Silent"]).default("Post-merge"),
  description: z.string().min(10).max(400),
  mitigation: z.string().min(5).max(400).optional().default(""),
  evidence: z.array(z.string()).default([]),
});
type Risk = z.infer<typeof RiskSchema>;
const RiskListSchema = z.array(RiskSchema).min(1).max(10);

const RecommendationSchema = z.object({
  category: z.enum(["Code", "Tests", "Docs", "Tooling", "DevEx", "Observability"]),
  title: z.string().min(5).max(160),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  effort: z.enum(["Low", "Medium", "High"]).default("Medium"),
  description: z.string().min(10).max(400),
  location: z.string().max(200).optional().default(""),
  example: z.string().max(400).optional().default(""),
});
type Recommendation = z.infer<typeof RecommendationSchema>;
const RecommendationListSchema = z.array(RecommendationSchema).min(1).max(10);

const CiIssueSchema = z.object({
  source: z.enum(["lint", "tests", "build", "security"]).or(z.string()),
  severity: z.enum(["P0", "P1", "P2", "P3"]),
  title: z.string().min(5).max(160),
  summary: z.string().min(10).max(400),
  suggestedCommands: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  owner: z.string().optional(),
  autoFixable: z.boolean().default(false),
});
type CiIssue = z.infer<typeof CiIssueSchema>;
const CiIssueListSchema = z.array(CiIssueSchema).min(1).max(12);

const CiFixSchema = z.object({
  title: z.string().min(5).max(160),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  steps: z.array(z.string()).default([]),
  owner: z.string().optional(),
  etaHours: z.number().min(0).max(40).optional(),
  commands: z.array(z.string()).default([]),
});
type CiFix = z.infer<typeof CiFixSchema>;
const CiFixListSchema = z.array(CiFixSchema).min(1).max(15);

type RepoContext = {
  cwd: string;
  branch: string;
  baseBranch: string;
  statusSummary: string;
  diffStat: string;
  diffSample: string;
  recentCommits: string;
};

type StatusCheck = {
  name: string;
  status: string;
  conclusion?: string;
  url?: string;
  workflow?: string;
};

type PrStatusSummary = {
  number?: number;
  title?: string;
  mergeState?: string;
  headRef?: string;
  baseRef?: string;
  statuses: StatusCheck[];
  ghChecksText?: string;
};

type ReviewAnalysis = {
  summary: string;
  intentions: Intention[];
  risks: Risk[];
  recommendations: Recommendation[];
  repoContext: RepoContext;
  prStatus?: PrStatusSummary | null;
  thread: Thread;
  ciHandoff?: Thread;
};

type CiAnalysis = {
  issues: CiIssue[];
  fixes: CiFix[];
  confidence: number;
  thread: Thread;
};

type ReverieResult = {
  conversationId: string;
  timestamp: string;
  relevance: number;
  excerpt: string;
  insights: string[];
};

type ProcessedReverie = ReverieResult & {
  rawRelevance: number;
  headRecords: string[];
  tailRecords: string[];
};

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

function runCommand(cmd: string, args: string[], cwd: string): CommandResult {
  try {
    const result = spawnSync(cmd, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      code: result.status ?? 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (error) {
    return { code: -1, stdout: "", stderr: String(error) };
  }
}

function limitText(input: string, maxLines = MAX_CONTEXT_LINES, maxChars = MAX_CONTEXT_CHARS): string {
  if (!input) return "";
  const lines = input.split(/\r?\n/);
  const trimmed = lines.slice(0, maxLines).join("\n");
  if (trimmed.length <= maxChars) {
    return trimmed.trimEnd();
  }
  return `${trimmed.slice(0, maxChars - 3)}...`;
}

function detectBaseBranch(cwd: string, override?: string): string {
  if (override) return override;
  const upstream = runCommand("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd);
  if (upstream.code === 0) {
    const value = upstream.stdout.trim();
    const slash = value.lastIndexOf("/");
    return slash === -1 ? value : value.slice(slash + 1);
  }
  return FALLBACK_BASE_BRANCH;
}

function collectRepoContext(cwd: string, baseOverride?: string): RepoContext {
  const branch = runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd).stdout.trim() || "unknown";
  const baseBranch = detectBaseBranch(cwd, baseOverride);
  const statusSummary = limitText(runCommand("git", ["status", "-sb"], cwd).stdout || "<no status>");
  const diffStat = limitText(runCommand("git", ["--no-pager", "diff", "--stat"], cwd).stdout || "<no diff>");
  const diffSample = limitText(runCommand("git", ["--no-pager", "diff", "-U3"], cwd).stdout || "<no diff sample>");
  const recentCommits = limitText(
    runCommand("git", ["--no-pager", "log", "-5", "--oneline"], cwd).stdout || "<no commits>",
    20,
    1200,
  );

  return {
    cwd,
    branch,
    baseBranch,
    statusSummary,
    diffStat,
    diffSample,
    recentCommits,
  };
}

function collectPrStatus(cwd: string): PrStatusSummary | null {
  const view = runCommand("gh", [
    "pr",
    "view",
    "--json",
    "number,title,mergeStateStatus,statusCheckRollup,headRefName,baseRefName",
  ], cwd);
  if (view.code !== 0) {
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(view.stdout);
  } catch {
    return null;
  }

  const statuses: StatusCheck[] = Array.isArray(parsed.statusCheckRollup)
    ? parsed.statusCheckRollup.map((item: any) => ({
        name: item?.name ?? item?.workflowName ?? "<unknown>",
        status: item?.status ?? "UNKNOWN",
        conclusion: item?.conclusion ?? undefined,
        url: item?.detailsUrl ?? undefined,
        workflow: item?.workflowName ?? undefined,
      }))
    : [];

  const checksText = runCommand("gh", ["pr", "checks"], cwd);

  return {
    number: parsed.number,
    title: parsed.title,
    mergeState: parsed.mergeStateStatus,
    headRef: parsed.headRefName,
    baseRef: parsed.baseRefName,
    statuses,
    ghChecksText: checksText.code === 0 ? limitText(checksText.stdout, 200, 4000) : undefined,
  };
}

function formatRepoContext(context: RepoContext): string {
  return `Branch: ${context.branch}\nBase: ${context.baseBranch}\nStatus:\n${context.statusSummary}\n\nDiff Stat:\n${context.diffStat}\n\nRecent Commits:\n${context.recentCommits}`;
}

function formatPrStatus(summary?: PrStatusSummary | null): string {
  if (!summary) {
    return "No open PR detected (gh pr view failed).";
  }
  const header = summary.number
    ? `PR #${summary.number} (${summary.title ?? "no title"}) [${summary.mergeState ?? "UNKNOWN"}]`
    : "PR status unknown";
  const statuses = summary.statuses.length === 0
    ? "(no checks reported)"
    : summary.statuses
        .map((s) => `- ${s.name}: ${s.status}${s.conclusion ? ` (${s.conclusion})` : ""}`)
        .join("\n");
  return `${header}\nHead: ${summary.headRef ?? "?"} -> Base: ${summary.baseRef ?? "?"}\nChecks:\n${statuses}`;
}

// ---------------------------------------------------------------------------
// PR Deep Reviewer
// ---------------------------------------------------------------------------

class PRDeepReviewer {
  private codex: Codex;
  private provider: CodexProvider;
  private runner: Runner;

  constructor(private readonly config: MultiAgentConfig) {
    this.codex = new Codex({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    this.provider = new CodexProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultModel: config.model ?? DEFAULT_MODEL,
      workingDirectory: config.workingDirectory,
      skipGitRepoCheck: config.skipGitRepoCheck,
    });
    this.runner = new Runner({ modelProvider: this.provider });
  }

  async reviewBranch(repoContext: RepoContext, prStatus?: PrStatusSummary | null): Promise<ReviewAnalysis> {
    console.log("🔍 Running codex.review() for branch analysis...");
    const target = repoContext.baseBranch
      ? { type: "branch", baseBranch: repoContext.baseBranch } as const
      : { type: "current_changes" } as const;

    const reviewResult = await this.codex.review({
      target,
      threadOptions: {
        model: this.config.model ?? DEFAULT_MODEL,
        workingDirectory: repoContext.cwd,
        skipGitRepoCheck: this.config.skipGitRepoCheck,
        fullAuto: true,
      },
    });

    const contextBlock = formatRepoContext(repoContext);
    const prBlock = formatPrStatus(prStatus);

    const model = await this.provider.getModel();

    const intentionAnalyzer = new Agent({
      name: "IntentionAnalyzer",
      model,
      instructions: `# Intention Analysis Agent

You are analyzing developer intent and architectural decisions behind code changes.

## Your Task
Extract the key intentions, goals, and architectural decisions from the provided diff and review context.

## Guidelines
1. Focus on the "why" not the "what" - understand motivations, not just mechanics
2. Identify explicit patterns: refactoring, feature additions, bug fixes, performance improvements
3. Note any architectural shifts: new abstractions, design pattern changes, dependency updates
4. Consider cross-cutting concerns: testability, maintainability, scalability implications
5. Flag any apparent mismatches between stated goals (from commits/PR) and actual changes
6. Distinguish between intentional changes vs. incidental side effects

## Output Format
Provide 5-8 bullet points in this format:
- **[Category]** Brief description of intent or architectural decision
  - Supporting evidence from diff (file/line references)
  - Impact: [scope of change - local/module/system-wide]

Categories: Feature, Refactor, BugFix, Performance, Security, DevEx, Architecture, Testing

## Constraints
- Be specific - cite actual files, functions, or modules
- Avoid speculation - stick to observable changes
- Distinguish between primary goals and secondary effects
- Each bullet should be actionable for follow-up analysis`,
    });
    const riskAssessor = new Agent({
      name: "RiskAssessor",
      model,
      instructions: `# Risk Assessment Agent

You are assessing risks, regressions, and rollout concerns for code changes.

## Your Task
Identify concrete risks that could impact production, users, or development workflow.

## Risk Categories
1. **Breaking Changes**: API changes, behavior modifications, removed features
2. **Performance Regressions**: Algorithm changes, resource usage, latency impact
3. **Correctness Risks**: Logic errors, edge cases, race conditions
4. **Security Vulnerabilities**: Auth bypasses, injection risks, data exposure
5. **Operational Risks**: Migration complexity, rollback difficulty, monitoring gaps
6. **Dependency Risks**: Version conflicts, supply chain, deprecations

## Assessment Framework
For each risk, evaluate:
- **Likelihood**: How probable is this to occur? (High/Medium/Low)
- **Impact**: What's the blast radius if it occurs? (Critical/High/Medium/Low)
- **Detectability**: Will we catch this before production? (Pre-deploy/Post-deploy/Silent)

## Output Format
Provide 4-8 risks in this format:
- **[Category] Risk Title**
  - **L**ikelihood: [H/M/L] | **I**mpact: [Critical/High/Medium/Low] | **D**etectability: [Pre/Post/Silent]
  - Description: What could go wrong and under what conditions
  - Evidence: Specific code locations or patterns that raise this concern
  - Mitigation: Brief suggestion for reducing risk

## Constraints
- Focus on risks introduced or amplified by THIS change, not pre-existing issues
- Be concrete - cite specific files, functions, or scenarios
- Differentiate between theoretical risks and likely risks
- Avoid false positives - only flag concerns you can substantiate`,
    });
    riskAssessor.instructions += `
## JSON Output
Respond ONLY with raw JSON objects like:
[
  {
    "category": "Architecture|Quality|Security|Performance|Process|Testing|Dependency|Regression",
    "title": "risk title",
    "likelihood": "High|Medium|Low",
    "impact": "Critical|High|Medium|Low",
    "detectability": "Pre-merge|Post-merge|Silent",
    "description": "what could go wrong",
    "mitigation": "suggested mitigation",
    "evidence": ["path/to/file.ts:45 - reason"]
  }
]`;
    intentionAnalyzer.instructions += `
## JSON Output
Respond ONLY with raw JSON (no prose, no backticks) shaped like:
[
  {
    "category": "Feature|Refactor|BugFix|Performance|Security|DevEx|Architecture|Testing",
    "title": "concise intent label",
    "summary": "why the change exists",
    "impactScope": "local|module|system",
    "evidence": ["path/to/file.ts:123 - supporting detail"]
  }
]`;
    const qualityReviewer = new Agent({
      name: "QualityReviewer",
      model,
      instructions: `# Code Quality & DevEx Reviewer

You are evaluating code quality, test coverage, and developer experience improvements.

## Your Task
Identify actionable improvements to code quality, testing, and team productivity.

## Evaluation Criteria

### Code Quality
1. Readability: naming, structure, complexity
2. Maintainability: modularity, coupling, documentation
3. Consistency: style alignment with codebase norms
4. Error handling: edge cases, validation, failure modes

### Test Coverage
1. Missing test cases: edge cases, error paths, integration scenarios
2. Test quality: brittleness, clarity, isolation
3. Test gaps: untested modules, uncovered branches

### DevEx (Developer Experience)
1. Documentation: inline comments, README updates, API docs
2. Tooling: build improvements, debugging aids, dev scripts
3. Onboarding: clarity for new contributors
4. Feedback loops: error messages, logging, observability

## Output Format
Provide 6-10 recommendations in this format:
- **[Category] Recommendation Title**
  - **Priority**: P0 (critical) / P1 (high) / P2 (medium) / P3 (low)
  - **Effort**: [Low/Medium/High] - estimated implementation complexity
  - Description: What to improve and why it matters
  - Location: Specific files, functions, or modules
  - Example: Concrete code snippet or test case to add (if applicable)

## Constraints
- Prioritize improvements with high impact / effort ratio
- Suggest follow-up tasks, not just observations
- Balance thoroughness with pragmatism - match the repo's quality bar
- Focus on improvements that will benefit future changes, not just this PR`,
    });
    qualityReviewer.instructions += `
## JSON Output
Respond ONLY with raw JSON matching:
[
  {
    "category": "Code|Tests|Docs|Tooling|DevEx|Observability",
    "title": "recommendation title",
    "priority": "P0|P1|P2|P3",
    "effort": "Low|Medium|High",
    "description": "actionable guidance",
    "location": "path/to/file or module",
    "example": "optional example snippet"
  }
]`;

    intentionAnalyzer.handoffs = [handoff(riskAssessor), handoff(qualityReviewer)];
    riskAssessor.handoffs = [handoff(qualityReviewer)];

    const intentionResult = await this.runner.run(
      intentionAnalyzer,
      `Repo context:\n${contextBlock}\n\nPR status:\n${prBlock}\n\nReview summary:\n${reviewResult.finalResponse}\n\nExtract the key intentions and architectural goals in <=8 bullets.`,
    );

    const riskResult = await this.runner.run(
      riskAssessor,
      `Use the same context plus the intention analysis below to map risks.\nIntentions:\n${intentionResult.finalOutput}\n\nList specific risks (with impact+likelihood).`,
    );

    const qualityResult = await this.runner.run(
      qualityReviewer,
      `Context:\n${contextBlock}\n\nReview:\n${reviewResult.finalResponse}\n\nRisks:\n${riskResult.finalOutput}\n\nProvide actionable recommendations (tests to add, refactors, follow-up tasks).`,
    );

    const reviewThread = this.codex.startThread({
      model: this.config.model ?? DEFAULT_MODEL,
      workingDirectory: repoContext.cwd,
      skipGitRepoCheck: this.config.skipGitRepoCheck,
      approvalMode: "on-request",
      sandboxMode: "workspace-write",
    });

    await reviewThread.run(`You already completed an automated branch review.\n\nBranch: ${repoContext.branch}\nBase: ${repoContext.baseBranch}\n\nRepo signals:\n${contextBlock}\n\nPR status summary:\n${prBlock}\n\nAutomated review findings:\n${reviewResult.finalResponse}\n\nSummarize the most critical insights and propose next investigative steps before I join via TUI.`);

    await reviewThread.run(`Log any CI or QA follow-ups you believe are necessary. You may soon fork to a CI triage agent; acknowledge by replying with a short checklist and the token 'CI-HANDOFF-READY'.`);

    let ciHandoff: Thread | undefined;
    try {
      ciHandoff = await reviewThread.fork({
        nthUserMessage: 1,
        threadOptions: {
          model: this.config.model ?? DEFAULT_MODEL,
          workingDirectory: repoContext.cwd,
          skipGitRepoCheck: this.config.skipGitRepoCheck,
          approvalMode: "on-request",
          sandboxMode: "workspace-write",
        },
      });
    } catch (error) {
      console.warn("⚠️ Unable to fork thread for CI handoff:", error);
    }

    return {
      summary: reviewResult.finalResponse ?? "",
      intentions: extractBullets(intentionResult.finalOutput),
      risks: extractBullets(riskResult.finalOutput),
      recommendations: extractBullets(qualityResult.finalOutput),
      repoContext,
      prStatus,
      thread: reviewThread,
      ciHandoff,
    };
  }

  async launchInteractiveReview(thread: Thread, data: ReviewAnalysis): Promise<NativeTuiExitInfo> {
    const prompt = `PR Review Ready\n\nSummary:\n${data.summary}\n\nIntentions:\n${data.intentions.map((i) => `• ${i}`).join("\n")}\n\nRisks:\n${data.risks.map((r) => `• ${r}`).join("\n")}\n\nRecommendations:\n${data.recommendations.map((r) => `• ${r}`).join("\n")}\n\nEnter the TUI and drill into any file or test you want.`;
    return thread.tui({ prompt, model: this.config.model ?? DEFAULT_MODEL });
  }
}

function extractBullets(text?: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-•*\d]/.test(line))
    .map((line) => line.replace(/^[-•*\d\.\)\s]+/, ""))
    .filter((line) => line.length > 0 && line.length <= 400);
}

// ---------------------------------------------------------------------------
// CI Checker System
// ---------------------------------------------------------------------------

class CICheckerSystem {
  private codex: Codex;
  private provider: CodexProvider;
  private runner: Runner;

  constructor(private readonly config: MultiAgentConfig) {
    this.codex = new Codex({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    this.provider = new CodexProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultModel: DEFAULT_MINI_MODEL,
      workingDirectory: config.workingDirectory,
      skipGitRepoCheck: config.skipGitRepoCheck,
    });
    this.runner = new Runner({ modelProvider: this.provider });
  }

  async checkAndFixCI(
    repoContext: RepoContext,
    prStatus: PrStatusSummary | null,
    ciThread?: Thread,
  ): Promise<CiAnalysis> {
    console.log("🔧 Running CI analysis agents...");
    const model = await this.provider.getModel();
    const ciSignal = `${formatRepoContext(repoContext)}\n\nPR/CI Status:\n${formatPrStatus(prStatus)}\n\nGH checks:\n${prStatus?.ghChecksText ?? "<no gh pr checks output>"}`;

    const lintChecker = new Agent({
      name: "LintChecker",
      model,
      instructions: `# Lint & Static Analysis Checker

You are predicting lint, style, and static analysis issues before CI runs.

## Your Task
Identify likely linter failures, type errors, and static analysis violations based on the diff and CI configuration.

## What to Check
1. **Linter Violations**: ESLint/Pylint/Clippy rules based on project config
2. **Type Errors**: TypeScript/Flow/mypy type mismatches
3. **Style Issues**: Formatting (Prettier/Black/rustfmt), naming conventions
4. **Static Analysis**: Unused imports, dead code, complexity warnings
5. **Language-Specific**: async/await patterns, null safety, memory safety

## Analysis Strategy
- Examine modified files for common anti-patterns
- Check if new code follows existing style patterns in the codebase
- Look for missing type annotations or imports
- Identify deprecated API usage or banned patterns

## Output Format
Provide 3-5 likely issues in this format:
- **[Tool] Issue Description**
  - File: path/to/file:line
  - Rule: specific-rule-id or error code
  - Reason: Why this will fail the check
  - Fix: Suggested command or code change

## Constraints
- Only flag issues you're confident will fail CI (avoid false positives)
- Provide actionable fixes, not just problem descriptions
- Include actual commands to run (e.g., \`eslint --fix\`, \`cargo clippy --fix\`)`,
    });
    const testChecker = new Agent({
      name: "TestChecker",
      model,
      instructions: `# Test Failure Predictor

You are predicting test failures and coverage gaps before CI runs.

## Your Task
Identify likely test failures and missing test coverage based on code changes.

## What to Check
1. **Direct Failures**: Tests that call modified functions
2. **Integration Failures**: Tests that depend on changed behavior
3. **Snapshot Mismatches**: UI/output changes requiring snapshot updates
4. **Flaky Tests**: Timing-sensitive or stateful tests affected by changes
5. **Coverage Gaps**: New code lacking test coverage

## Analysis Strategy
- Trace modified functions to their test callers
- Identify breaking API changes (signature, return type, behavior)
- Look for new branches/functions without corresponding tests
- Check for race conditions or async changes affecting test stability

## Output Format
Provide 4-6 predictions in this format:
- **[Category] Test Suite/File**
  - Likelihood: High/Medium/Low
  - Failure Type: Assertion/Timeout/Error/Coverage
  - Reason: What changed that will break this test
  - Fix: Specific test updates needed or new tests to add
  - Command: How to run this test locally

## Constraints
- Focus on tests that will definitely or likely fail, not theoretical gaps
- Provide specific test file names and function names when possible
- Suggest commands to reproduce locally (e.g., \`npm test -- --testNamePattern=...\`)`,
    });
    const buildChecker = new Agent({
      name: "BuildChecker",
      model,
      instructions: `# Build & Dependency Checker

You are detecting build, packaging, and dependency issues before CI runs.

## Your Task
Identify likely build failures, dependency conflicts, and cross-platform issues.

## What to Check
1. **Compilation Errors**: Syntax, imports, missing dependencies
2. **Dependency Conflicts**: Version mismatches, peer dependency issues
3. **Platform Issues**: OS-specific code, architecture-dependent builds
4. **Build Script Errors**: Webpack/Rollup/Cargo config issues
5. **Asset Problems**: Missing files, broken paths, resource loading
6. **Incremental Build**: Cache invalidation, stale artifacts

## Analysis Strategy
- Check if new imports are declared in package.json/Cargo.toml/requirements.txt
- Look for platform-specific code without proper conditionals
- Identify breaking changes in dependency APIs
- Check for missing build steps or asset generation

## Output Format
Provide 3-5 predictions in this format:
- **[Category] Build Issue**
  - Severity: Blocking/Warning
  - Platform: All/Linux/macOS/Windows or Language/Runtime version
  - Reason: What will cause the build to fail
  - Detection: Which CI step will catch this (compile/bundle/package)
  - Fix: Specific change to make (add dep, update config, fix import)
  - Command: How to reproduce locally

## Constraints
- Prioritize blocking build failures over warnings
- Be specific about which platform/config will fail
- Provide actual commands or config changes, not just descriptions`,
    });
    const securityChecker = new Agent({
      name: "SecurityChecker",
      model,
      instructions: `# Security & Secrets Checker

You are identifying security vulnerabilities and secrets hygiene issues.

## Your Task
Flag security risks and secret exposure that CI security scans will catch or should catch.

## What to Check
1. **Hardcoded Secrets**: API keys, tokens, passwords in code
2. **Injection Vulnerabilities**: SQL injection, XSS, command injection
3. **Auth/Authz Bypass**: Missing checks, broken access control
4. **Cryptography Issues**: Weak algorithms, insecure random, bad key management
5. **Dependency Vulnerabilities**: Known CVEs in dependencies
6. **Data Exposure**: Logging sensitive data, debug output in production

## Analysis Strategy
- Scan for string literals that look like secrets (regex patterns)
- Identify user input flowing into dangerous sinks (SQL, eval, exec)
- Check for missing authentication/authorization on new endpoints
- Look for cryptographic primitives used incorrectly
- Check if sensitive data is logged or exposed in errors

## Output Format
Provide 2-4 security concerns in this format:
- **[Severity: Critical/High/Medium] Issue Title**
  - Category: Secrets/Injection/Auth/Crypto/Dependency/DataExposure
  - Location: path/to/file:line
  - Risk: What could be exploited and by whom
  - Detection: Will CI catch this? (Static analysis/Secrets scan/Manual review)
  - Fix: Specific remediation (use env var, sanitize input, add auth check)

## Constraints
- Only flag genuine security issues, not theoretical hardening
- Differentiate between "will fail CI" vs "should be fixed but CI might miss"
- Be explicit about severity - not everything is Critical
- Provide concrete fixes, not just "fix the vulnerability"`,
    });
    const fixer = new Agent({
      name: "CIFixer",
      model,
      instructions: `# CI Issue Remediation Planner

You are synthesizing CI issues from multiple checkers and creating an ordered fix plan.

## Your Task
Aggregate all predicted CI issues and generate a prioritized, actionable remediation checklist.

## Prioritization Framework
1. **P0 - Blockers**: Build failures, critical security issues
2. **P1 - Urgent**: Test failures, type errors, high-severity lint
3. **P2 - Normal**: Coverage gaps, medium-severity security, warnings
4. **P3 - Low**: Style nits, minor refactors, documentation

## Remediation Plan Structure
For each issue group:
1. **Triage**: Which issues are duplicates or related?
2. **Dependencies**: What must be fixed first? (build before test, etc.)
3. **Batch Fixes**: What can be fixed with one command? (e.g., \`eslint --fix\`)
4. **Manual Fixes**: What requires code changes?

## Output Format
\`\`\`markdown
# CI Remediation Plan

## Summary
- Total Issues: X (P0: A, P1: B, P2: C, P3: D)
- Estimated Time: ~X hours
- Auto-fixable: Y issues

## Phase 1: Blockers (P0)
- [ ] **Build** Fix missing dependency in package.json
  - Run: \`npm install --save @types/node\`
  - Files: package.json
  - Owner: Build team

## Phase 2: Urgent (P1)
...

## Quick Wins (Batch Fixes)
\`\`\`bash
# Run all auto-fixes
npm run lint:fix
cargo fmt
pytest --co -q  # Check which tests will run
\`\`\`

## Manual Intervention Required
1. **Test Failures**: Update snapshot tests after UI changes
   - Run: \`npm test -- -u\`
   - Review: Ensure snapshots are correct, not just updated

## Validation Checklist
- [ ] All linters pass locally
- [ ] All tests pass locally
- [ ] Build succeeds on all platforms
- [ ] Security scan clean
\`\`\`

## Constraints
- Group related issues to avoid redundant fixes
- Provide copy-paste commands wherever possible
- Estimate time/effort for manual fixes
- Call out any fixes that need team discussion or design decisions`,
    });

    lintChecker.handoffs = [handoff(fixer)];
    testChecker.handoffs = [handoff(fixer)];
    buildChecker.handoffs = [handoff(fixer)];
    securityChecker.handoffs = [handoff(fixer)];

    const prompts = {
      lint: `${ciSignal}\n\nTask: enumerate lint/static-analysis issues likely to fail CI. Include file hints or commands.`,
      test: `${ciSignal}\n\nTask: identify tests likely to fail or be missing. Include pytest/cargo/jest commands.`,
      build: `${ciSignal}\n\nTask: identify build or dependency issues across OS targets.`,
      security: `${ciSignal}\n\nTask: point out security vulnerabilities or secrets hygiene risks in this diff.`,
    };

    const [lintResult, testResult, buildResult, securityResult] = await Promise.all([
      this.runner.run(lintChecker, prompts.lint),
      this.runner.run(testChecker, prompts.test),
      this.runner.run(buildChecker, prompts.build),
      this.runner.run(securityChecker, prompts.security),
    ]);

    const findings = [lintResult, testResult, buildResult, securityResult]
      .map((result) => result?.finalOutput ?? "")
      .join("\n\n");

    const fixerResult = await this.runner.run(
      fixer,
      `${ciSignal}\n\nAggregated findings:\n${findings}\n\nProduce a prioritized remediation checklist with owners and commands.`,
    );

    const issues = extractIssues(fixingsText(findings));
    const fixes = extractBullets(fixerResult.finalOutput);
    const confidence = Math.min(0.99, Math.max(0.2, fixes.length / Math.max(1, issues.length + 2)));

    const thread =
      ciThread ??
      this.codex.startThread({
        model: this.config.model ?? DEFAULT_MODEL,
        workingDirectory: repoContext.cwd,
        skipGitRepoCheck: this.config.skipGitRepoCheck,
        approvalMode: "on-request",
        sandboxMode: "workspace-write",
      });

    await thread.run(`CI signal summary as of ${new Date().toISOString()}\n\n${ciSignal}\n\nIssues:\n${issues.map((i) => `• ${i}`).join("\n")}\n\nRecommended fixes:\n${fixes.map((f) => `• ${f}`).join("\n")}\n\nReturn a short confirmation and be ready to continue interactively.`);

    return {
      issues,
      fixes,
      confidence,
      thread,
    };
  }

  async launchInteractiveFixing(thread: Thread, data: CiAnalysis): Promise<NativeTuiExitInfo> {
    const prompt = `CI Analysis\nConfidence: ${(data.confidence * 100).toFixed(1)}%\n\nIssues:\n${data.issues.map((i) => `• ${i}`).join("\n")}\n\nFixes:\n${data.fixes.map((f) => `• ${f}`).join("\n")}\n\nLet's jump into the TUI and apply/validate these fixes.`;
    return thread.tui({ prompt, model: this.config.model ?? DEFAULT_MODEL });
  }
}

function fixingsText(text: string): string {
  return text || "";
}

function extractIssues(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .filter((line) => /risk|fail|error|issue|break|missing/i.test(line))
    .map((line) => line.replace(/^[-•*\d\.\)\s]+/, "").trim())
    .filter((line) => line.length > 0);
}

// ---------------------------------------------------------------------------
// Reverie System Helpers
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0, aMag = 0, bMag = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }

  if (aMag === 0 || bMag === 0) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function extractCompactTextFromRecords(headRecords: string[], tailRecords: string[], insights: string[]): string {
  const texts: string[] = [];

  // Extract from head records
  for (const line of headRecords) {
    try {
      const obj = JSON.parse(line);
      const content = obj?.content || obj?.text;
      if (typeof content === "string" && content.trim()) {
        texts.push(content);
      }
    } catch {
      // ignore parse errors
    }
  }

  // Extract from tail records
  for (const line of tailRecords) {
    try {
      const obj = JSON.parse(line);
      const content = obj?.content || obj?.text;
      if (typeof content === "string" && content.trim()) {
        texts.push(content);
      }
    } catch {
      // ignore parse errors
    }
  }

  // Include insights
  texts.push(...insights);

  // Limit total length to avoid embedding large documents
  const combined = texts.join(" ").slice(0, 4000);
  return combined;
}

function resolveCodexHome(): string {
  return process.env.CODEX_HOME || path.join(process.env.HOME || process.cwd(), ".codex");
}


// ---------------------------------------------------------------------------
// Reverie System (with embedding re-ranking)
// ---------------------------------------------------------------------------

class ReverieSystem {
  private embedderReady = false;

  constructor(private readonly config: MultiAgentConfig) {}

  async searchReveries(query: string): Promise<ReverieResult[]> {
    console.log(`🔍 Searching reveries for: "${query}"`);
    const codexHome = resolveCodexHome();
    console.log(`📁 Codex home: ${codexHome}`);

    // Prefer native reverie functions if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const native: any = require("@codex-native/sdk");
      if (native && typeof native.reverieSearchConversations === "function") {
        const results = await native.reverieSearchConversations(codexHome, query, 25);

        // Filter to conversations whose SessionMeta.cwd is inside our workingDirectory
        const projectRoot = path.resolve(this.config.workingDirectory);
        const scoped = (results as any[]).filter((r) => {
          const head: string[] | undefined = r?.conversation?.headRecords;
          if (!Array.isArray(head) || head.length === 0) return false;
          for (const line of head) {
            try {
              const obj = JSON.parse(line);
              const cwd = obj?.meta?.cwd || obj?.cwd; // handle SessionMetaLine vs flattened
              if (typeof cwd === "string") {
                const normalized = path.resolve(cwd);
                if (normalized === projectRoot || normalized.startsWith(projectRoot + path.sep)) {
                  return true;
                }
              }
            } catch {
              // ignore parse errors
            }
          }
          return false;
        });

        // Re-rank with embeddings if embedder is available
        let processed: ProcessedReverie[] = scoped.map((r) => ({
          conversationId: r.conversation?.id || "unknown",
          timestamp: r.conversation?.createdAt || new Date().toISOString(),
          relevance: typeof r.relevanceScore === "number" ? r.relevanceScore : 0.7,
          excerpt: (r.matchingExcerpts && r.matchingExcerpts[0]) || "",
          insights: Array.isArray(r.insights) ? r.insights : [],
          // Store raw data for embedding processing
          headRecords: Array.isArray(r.conversation?.headRecords) ? r.conversation.headRecords : [],
          tailRecords: Array.isArray(r.conversation?.tailRecords) ? r.conversation.tailRecords : [],
          rawRelevance: typeof r.relevanceScore === "number" ? r.relevanceScore : 0.7,
        }));

        if (this.config.embedder) {
          processed = await this.rerankWithEmbeddings(query, processed);
        }

        // Return top 10 results, remove internal fields
        return processed.slice(0, 10).map(({ headRecords, tailRecords, rawRelevance, ...result }) => result);
      }
    } catch {
      // ignore and fallback
    }

    // Fallback placeholder
    const now = Date.now();
    return [
      {
        conversationId: `reverie-${now}`,
        timestamp: new Date(now).toISOString(),
        relevance: 0.75,
        excerpt: `No native reverie results; placeholder for: ${query}`,
        insights: ["Consider reusing patterns from prior CI fixes."],
      },
    ];
  }

  private async ensureEmbedderReady(): Promise<void> {
    if (this.embedderReady || !this.config.embedder) {
      return;
    }
    await fastEmbedInit(this.config.embedder.initOptions);
    this.embedderReady = true;
  }

  private async rerankWithEmbeddings(
    query: string,
    items: ProcessedReverie[],
  ): Promise<ProcessedReverie[]> {
    if (!this.config.embedder || items.length === 0) {
      return items;
    }
    try {
      await this.ensureEmbedderReady();

      const docTexts = items.map((item) =>
        extractCompactTextFromRecords(item.headRecords, item.tailRecords, item.insights),
      );
      const projectRoot = path.resolve(this.config.workingDirectory);
      const baseRequest = this.config.embedder.embedRequest ?? {};
      const embedRequest: FastEmbedEmbedRequest = {
        ...baseRequest,
        projectRoot,
        cache: baseRequest.cache ?? true,
        inputs: [query, ...docTexts],
      };

      const embeddings = await fastEmbedEmbed(embedRequest);
      if (embeddings.length !== docTexts.length + 1) {
        throw new Error("Embedding API returned unexpected length");
      }

      const [queryVector, ...docVectors] = embeddings;
      if (!queryVector) {
        return items;
      }

      const reranked = items.map((item, idx) => {
        const docEmbedding = docVectors[idx];
        if (!docEmbedding) {
          return item;
        }
        const semanticScore = cosineSimilarity(queryVector, docEmbedding);
        const blendedScore = 0.7 * semanticScore + 0.3 * item.rawRelevance;
        return { ...item, relevance: blendedScore };
      });
      reranked.sort((a, b) => b.relevance - a.relevance);
      return reranked;
    } catch (error) {
      console.warn("Embedding re-ranking failed:", error);
      return items;
    }
  }

  async injectReverie(thread: Thread, reveries: ReverieResult[], query: string): Promise<void> {
    if (reveries.length === 0) return;
    const note = `Injecting reverie learnings for '${query}':\n${reveries
      .map((r, idx) => `#${idx + 1} (${Math.round(r.relevance * 100)}%): ${r.insights.join("; ")}`)
      .join("\n")}`;
    await thread.run(note);
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

class MultiAgentOrchestrator {
  private reviewer: PRDeepReviewer;
  private ciChecker: CICheckerSystem;
  private reverie: ReverieSystem;

  constructor(private readonly config: MultiAgentConfig) {
    this.reviewer = new PRDeepReviewer(config);
    this.ciChecker = new CICheckerSystem(config);
    this.reverie = new ReverieSystem(config);
  }

  async runWorkflow(): Promise<void> {
    console.log("🚀 Multi-Agent Codex Workflow started");
    const repoContext = collectRepoContext(this.config.workingDirectory, this.config.baseBranchOverride);
    const prStatus = collectPrStatus(this.config.workingDirectory);

    let reviewData: ReviewAnalysis | null = null;

    if (this.config.reviewBranch) {
      reviewData = await this.reviewer.reviewBranch(repoContext, prStatus);
      logReviewSummary(reviewData);
      if (this.config.interactive) {
        await this.reviewer.launchInteractiveReview(reviewData.thread, reviewData);
      }
    }

    if (this.config.ciCheck) {
      const ciResult = await this.ciChecker.checkAndFixCI(repoContext, prStatus, reviewData?.ciHandoff);
      logCiSummary(ciResult);
      if (this.config.interactive) {
        await this.ciChecker.launchInteractiveFixing(ciResult.thread, ciResult);
      }
    }

    if (this.config.reverieQuery) {
      const reveries = await this.reverie.searchReveries(this.config.reverieQuery);
      const codex = new Codex({ baseUrl: this.config.baseUrl, apiKey: this.config.apiKey });
      const thread = codex.startThread({
        model: this.config.model ?? DEFAULT_MODEL,
        workingDirectory: this.config.workingDirectory,
        skipGitRepoCheck: this.config.skipGitRepoCheck,
      });
      await this.reverie.injectReverie(thread, reveries, this.config.reverieQuery);
      if (this.config.interactive) {
        await thread.tui({
          prompt: `Injected ${reveries.length} reverie insight(s) for '${this.config.reverieQuery}'. Continue the discussion.`,
        });
      }
    }

    if (!this.config.reviewBranch && !this.config.ciCheck && !this.config.reverieQuery) {
      await this.runIntegratedSession(repoContext, prStatus);
    }
  }

  private async runIntegratedSession(repoContext: RepoContext, prStatus: PrStatusSummary | null) {
    const codex = new Codex({ baseUrl: this.config.baseUrl, apiKey: this.config.apiKey });
    const thread = codex.startThread({
      model: this.config.model ?? DEFAULT_MODEL,
      workingDirectory: this.config.workingDirectory,
      skipGitRepoCheck: this.config.skipGitRepoCheck,
    });

    const prompt = `Integrated Multi-Agent Session\n\nRepo context:\n${formatRepoContext(repoContext)}\n\nPR status:\n${formatPrStatus(prStatus)}\n\nAvailable commands:\n- type 'review branch' to start automated review\n- type 'check ci' to inspect CI\n- type 'reverie <topic>' to search past insights\n\nHow can I help?`;

    if (this.config.interactive) {
      await thread.tui({ prompt });
    } else {
      const turn = await thread.run(prompt);
      console.log("🤖", turn.finalResponse);
    }
  }
}

function logReviewSummary(data: ReviewAnalysis): void {
  console.log("\n📋 Review Summary");
  console.log("Summary:", data.summary.slice(0, 600), "...\n");
  console.log("Top Intentions:", data.intentions.slice(0, 5));
  console.log("Top Risks:", data.risks.slice(0, 5));
  console.log("Recommendations:", data.recommendations.slice(0, 5));
}

function logCiSummary(data: CiAnalysis): void {
  console.log("\n🔧 CI Summary");
  console.log("Issues:", data.issues.slice(0, 5));
  console.log("Fixes:", data.fixes.slice(0, 5));
  console.log("Confidence:", `${(data.confidence * 100).toFixed(1)}%`);
}

// ---------------------------------------------------------------------------
// Example: Using with OpenAI Embeddings
// ---------------------------------------------------------------------------

/*
// Example embedder configuration using FastEmbed via the native SDK:

const config: MultiAgentConfig = {
  workingDirectory: process.cwd(),
  skipGitRepoCheck: true,
  embedder: {
    initOptions: {
      model: "BAAI/bge-large-en-v1.5",
    },
    embedRequest: {
      normalize: true,
    },
  },
};
*/

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(): MultiAgentConfig {
  const args = process.argv.slice(2);
  const config: MultiAgentConfig = {
    workingDirectory: process.cwd(),
    skipGitRepoCheck: true,
  };

  let embedderModel: string | undefined;
  let embedderMaxLength: number | undefined;
  let embedderCacheDir: string | undefined;
  let embedderCacheEnabled = true;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--review-branch":
        config.reviewBranch = true;
        break;
      case "--ci-check":
        config.ciCheck = true;
        break;
      case "--interactive":
      case "-i":
        config.interactive = true;
        break;
      case "--reverie":
      case "--search":
        config.reverieQuery = args[++i];
        break;
      case "--model":
        config.model = args[++i];
        break;
      case "--base-branch":
        config.baseBranchOverride = args[++i];
        break;
      case "--cwd":
      case "--working-dir":
        config.workingDirectory = path.resolve(args[++i]);
        break;
      case "--api-key":
        config.apiKey = args[++i];
        break;
      case "--base-url":
        config.baseUrl = args[++i];
        break;
      case "--embedder-model":
        embedderModel = args[++i];
        break;
      case "--embedder-max-length":
        embedderMaxLength = Number(args[++i]);
        break;
      case "--embedder-cache-dir":
        embedderCacheDir = args[++i];
        break;
      case "--embedder-no-cache":
        embedderCacheEnabled = false;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith("--")) {
          config.reverieQuery = arg;
        }
        break;
    }
  }

  // Configure embedder if any embedder options were provided
  if (
    embedderModel ||
    embedderCacheDir ||
    embedderMaxLength !== undefined ||
    !embedderCacheEnabled
  ) {
    const normalizedMaxLength =
      embedderMaxLength !== undefined && Number.isFinite(embedderMaxLength)
        ? Math.max(1, Math.floor(embedderMaxLength))
        : undefined;
    config.embedder = {
      initOptions: {
        model: embedderModel,
        cacheDir: embedderCacheDir,
        maxLength: normalizedMaxLength,
      },
      embedRequest: {
        normalize: true,
        cache: embedderCacheEnabled,
      },
    };
  }

  return config;
}

function printUsage(): void {
  console.log(`
Multi-Agent Codex System
Usage: npx tsx multi-agent-codex-system.ts [options]

Options:
  --review-branch          Run automated branch review before handing to TUI
  --ci-check               Run CI prediction & fixer workflow
  --reverie <query>        Look up prior learnings (placeholder)
  --interactive, -i        Launch TUIs for each stage
  --model <name>           Override default model (default ${DEFAULT_MODEL})
  --base-branch <name>     Override detected base branch
  --cwd <path>             Working directory (default: cwd)
  --api-key <key>          Codex API key
  --base-url <url>         Codex API base URL
  --embedder-model <id>        FastEmbed model ID (e.g., BAAI/bge-large-en-v1.5)
  --embedder-max-length <n>    Override FastEmbed tokenizer max length
  --embedder-cache-dir <path>  Override FastEmbed model cache directory
  --embedder-no-cache          Disable on-disk embedding cache
  --help                   Show this message
`);
}

async function main(): Promise<void> {
  const config = parseArgs();
  if (config.interactive && (!process.stdout.isTTY || !process.stdin.isTTY)) {
    console.error("❌ Interactive mode requires a TTY terminal.");
    process.exit(1);
  }
  const orchestrator = new MultiAgentOrchestrator(config);
  await orchestrator.runWorkflow();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
}

export {
  MultiAgentOrchestrator,
  PRDeepReviewer,
  CICheckerSystem,
  ReverieSystem,
  type MultiAgentConfig,
  type ReviewAnalysis,
  type CiAnalysis,
  type RepoContext,
};
