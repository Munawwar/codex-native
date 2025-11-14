import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

import { Agent, Runner } from "@openai/agents";
import type { JsonSchemaDefinition } from "@openai/agents-core";
import {
  CodexProvider,
  fastEmbedInit,
  reverieSearchSemantic,
  type ReverieSemanticSearchOptions,
} from "@codex-native/sdk";

type FileChange = {
  path: string;
  status: string;
  diff: string;
  truncated: boolean;
  previousPath?: string;
};

type BranchDiffContext = {
  repoPath: string;
  branch: string;
  baseBranch: string;
  upstreamRef?: string;
  mergeBase: string;
  statusSummary: string;
  diffStat: string;
  recentCommits: string;
  changedFiles: FileChange[];
  totalChangedFiles: number;
};

type BranchIntentPlan = {
  intent_summary: string;
  objectives: Array<{ title: string; evidence: string; impact_scope: "local" | "module" | "system" }>;
  risk_flags: string[];
  file_focus: Array<{ file: string; reason: string; urgency: "low" | "medium" | "high" }>;
};

type FileAssessment = {
  file: string;
  change_intent: string;
  necessity: "required" | "questionable" | "unnecessary";
  minimally_invasive: boolean;
  unnecessary_changes: string[];
  recommendations: string[];
  risk_level: "info" | "low" | "medium" | "high";
};

type ReverieInsight = {
  conversationId: string;
  timestamp: string;
  relevance: number;
  excerpt: string;
  insights: string[];
};

type ReverieContext = {
  branch: ReverieInsight[];
  perFile: Map<string, ReverieInsight[]>;
};

const DEFAULT_DIFF_AGENT_REPO = fs.existsSync("/Volumes/sandisk/codex/multi-agent-codex-system")
  ? "/Volumes/sandisk/codex/multi-agent-codex-system"
  : path.resolve(process.cwd(), "multi-agent-codex-system");
const DEFAULT_BRANCH = "main";
const DEFAULT_MODEL = "gpt-5-codex";
const REVERSIBLE_STATUS = new Set(["M", "A", "D", "R", "C"]);
const MAX_STATUS_LINES = 200;
const MAX_STATUS_CHARS = 4_800;
const MAX_COMMIT_CHARS = 1_200;
const MAX_DIFF_CHARS = 16_000;
const DEFAULT_MAX_FILES = 12;
const DEFAULT_REVERIE_LIMIT = 6;
const DEFAULT_REVERIE_MAX_CANDIDATES = 80;
const REVERIE_EMBED_MODEL = "BAAI/bge-large-en-v1.5";
const REVERIE_RERANKER_MODEL = "BAAI/bge-reranker-v2-m3";
const LOG_LABEL = "[DiffAgent]";
let reverieReady = false;

const BRANCH_PLAN_OUTPUT_TYPE: JsonSchemaDefinition = {
  type: "json_schema",
  name: "DiffBranchOverview",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intent_summary", "objectives", "risk_flags", "file_focus"],
    properties: {
      intent_summary: { type: "string", minLength: 20, maxLength: 1_200 },
      objectives: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "evidence", "impact_scope"],
          properties: {
            title: { type: "string", minLength: 5, maxLength: 160 },
            evidence: { type: "string", minLength: 5, maxLength: 400 },
            impact_scope: { type: "string", enum: ["local", "module", "system"] },
          },
        },
      },
      risk_flags: {
        type: "array",
        maxItems: 8,
        items: { type: "string", minLength: 5, maxLength: 240 },
      },
      file_focus: {
        type: "array",
        minItems: 1,
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["file", "reason", "urgency"],
          properties: {
            file: { type: "string", minLength: 1, maxLength: 260 },
            reason: { type: "string", minLength: 5, maxLength: 240 },
            urgency: { type: "string", enum: ["low", "medium", "high"] },
          },
        },
      },
    },
  },
};

const FILE_ASSESSMENT_OUTPUT_TYPE: JsonSchemaDefinition = {
  type: "json_schema",
  name: "DiffFileAssessment",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "file",
      "change_intent",
      "necessity",
      "minimally_invasive",
      "unnecessary_changes",
      "recommendations",
      "risk_level",
    ],
    properties: {
      file: { type: "string", minLength: 1, maxLength: 260 },
      change_intent: { type: "string", minLength: 10, maxLength: 600 },
      necessity: { type: "string", enum: ["required", "questionable", "unnecessary"] },
      minimally_invasive: { type: "boolean" },
      unnecessary_changes: {
        type: "array",
        maxItems: 6,
        items: { type: "string", minLength: 5, maxLength: 220 },
      },
      recommendations: {
        type: "array",
        maxItems: 6,
        items: { type: "string", minLength: 5, maxLength: 220 },
      },
      risk_level: { type: "string", enum: ["info", "low", "medium", "high"] },
    },
  },
};

const repoPath = process.env.CX_DIFF_AGENT_REPO ?? DEFAULT_DIFF_AGENT_REPO;
const baseOverride = process.env.CX_DIFF_AGENT_BASE;
const baseUrl = process.env.CODEX_BASE_URL;
const apiKey = process.env.CODEX_API_KEY;
const model = process.env.CX_DIFF_AGENT_MODEL ?? DEFAULT_MODEL;
const maxFiles = parseEnvInt(process.env.CX_DIFF_AGENT_MAX_FILES, DEFAULT_MAX_FILES);

void main().catch((error) => {
  console.error(`${LOG_LABEL} fatal error`, error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const resolvedRepo = assertRepo(repoPath);
  const context = collectBranchContext(resolvedRepo, baseOverride, maxFiles);
  if (context.changedFiles.length === 0) {
    console.log(`${LOG_LABEL} No changed files detected between ${context.mergeBase} and HEAD.`);
    return;
  }

  const runner = createRunner(resolvedRepo, { model, baseUrl, apiKey });
  const reverieContext = await collectReverieContext(context);
  const branchPlan = await analyzeBranchIntent(runner, context, reverieContext.branch);

  renderBranchReport(context, branchPlan, reverieContext.branch);

  for (const change of context.changedFiles) {
    const insights = reverieContext.perFile.get(change.path) ?? [];
    const assessment = await assessFileChange(runner, context, change, branchPlan, insights);
    renderFileAssessment(assessment, change, insights);
  }
}

function createRunner(
  repo: string,
  options: { model: string; baseUrl?: string; apiKey?: string },
): Runner {
  const provider = new CodexProvider({
    workingDirectory: repo,
    skipGitRepoCheck: true,
    defaultModel: options.model,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
  });
  return new Runner({ modelProvider: provider });
}

function collectBranchContext(repo: string, baseRefOverride: string | undefined, maxFilesToInclude: number): BranchDiffContext {
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], repo).stdout.trim() || "unknown";
  const upstream = detectUpstream(repo);
  const baseBranch = baseRefOverride || upstream?.split("/").slice(-1)[0] || DEFAULT_BRANCH;
  const targetRef = baseRefOverride || upstream || baseBranch;
  const mergeBaseCommand = runGit(["merge-base", "HEAD", targetRef], repo);
  const mergeBase = mergeBaseCommand.stdout.trim() || targetRef || "HEAD";
  const statusSummary = limitText(runGit(["status", "-sb"], repo).stdout, MAX_STATUS_LINES, MAX_STATUS_CHARS) || "<no status>";
  const diffStat = limitText(
    runGit(["--no-pager", "diff", "--stat", `${mergeBase}...HEAD`], repo).stdout,
    MAX_STATUS_LINES,
    MAX_STATUS_CHARS,
  ) || "<no diff stat>";
  const recentCommits = limitText(
    runGit(["--no-pager", "log", "-5", "--oneline"], repo).stdout,
    20,
    MAX_COMMIT_CHARS,
  ) || "<no commits>";

  const fileList = parseChangedFiles(
    runGit(["--no-pager", "diff", "--name-status", "--find-renames", `${mergeBase}...HEAD`], repo).stdout,
  );
  const limitedFiles = fileList.slice(0, maxFilesToInclude);
  const fileDiffs = limitedFiles.map((entry) => {
    const diffResult = readFileDiff(repo, mergeBase, entry.path, entry.previousPath);
    return {
      ...entry,
      diff: diffResult.diff,
      truncated: diffResult.truncated,
    };
  });

  return {
    repoPath: repo,
    branch,
    baseBranch,
    upstreamRef: targetRef,
    mergeBase,
    statusSummary,
    diffStat,
    recentCommits,
    changedFiles: fileDiffs,
    totalChangedFiles: fileList.length,
  };
}

function parseChangedFiles(raw: string): FileChange[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [statusChunk, ...rest] = line.split(/\s+/);
      if (!statusChunk) return null;
      const status = statusChunk[0];
      if (!REVERSIBLE_STATUS.has(status)) return null;
      if (status === "R" || status === "C") {
        const arrowIndex = line.indexOf("\t");
        if (arrowIndex === -1) return null;
        const parts = line.split("\t");
        const prev = parts[1];
        const next = parts[2];
        if (!prev || !next) return null;
        return { path: next.trim(), status, truncated: false, diff: "", previousPath: prev.trim() };
      }
      const path = rest.join(" ").trim();
      if (!path) return null;
      return { path, status, truncated: false, diff: "" };
    })
    .filter((entry): entry is FileChange => Boolean(entry));
}

function readFileDiff(
  repo: string,
  mergeBase: string,
  filePath: string,
  previousPath?: string,
): { diff: string; truncated: boolean } {
  const target = previousPath && previousPath !== filePath ? previousPath : filePath;
  const diff = runGit(["--no-pager", "diff", "-U5", `${mergeBase}...HEAD`, "--", target], repo).stdout;
  if (diff.length <= MAX_DIFF_CHARS) {
    return { diff: diff.trim() || `<no diff for ${filePath}>`, truncated: false };
  }
  return { diff: `${diff.slice(0, MAX_DIFF_CHARS)}\n...\n<diff truncated>`, truncated: true };
}

function detectUpstream(repo: string): string | undefined {
  const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], repo);
  if (upstream.code === 0) {
    return upstream.stdout.trim();
  }
  return undefined;
}

function runGit(args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function limitText(input: string, maxLines: number, maxChars: number): string {
  if (!input) return "";
  const lines = input.split(/\r?\n/).slice(0, maxLines);
  const joined = lines.join("\n");
  if (joined.length <= maxChars) {
    return joined.trimEnd();
  }
  return `${joined.slice(0, maxChars - 3)}...`;
}

async function collectReverieContext(context: BranchDiffContext): Promise<ReverieContext> {
  const branchContext = [
    `Branch: ${context.branch} -> Base: ${context.baseBranch}`,
    `Status:\n${context.statusSummary}`,
    `Diff stat:\n${context.diffStat}`,
    `Recent commits:\n${context.recentCommits}`,
  ].join("\n\n");
  const branchInsights = await searchReveries(branchContext, context.repoPath);
  const perFile = new Map<string, ReverieInsight[]>();
  for (const change of context.changedFiles) {
    const snippet = `${change.path}\nStatus: ${change.status}\n\n${change.diff.slice(0, 4_000)}`;
    const matches = await searchReveries(snippet, context.repoPath, DEFAULT_REVERIE_LIMIT, DEFAULT_REVERIE_MAX_CANDIDATES / 2);
    if (matches.length > 0) {
      perFile.set(change.path, matches);
    }
  }
  return { branch: branchInsights, perFile };
}

async function searchReveries(
  text: string,
  repo: string,
  limit = DEFAULT_REVERIE_LIMIT,
  maxCandidates = DEFAULT_REVERIE_MAX_CANDIDATES,
): Promise<ReverieInsight[]> {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  if (!fs.existsSync(codexHome)) {
    return [];
  }
  await ensureReverieReady();
  const options: ReverieSemanticSearchOptions = {
    projectRoot: repo,
    limit,
    maxCandidates,
    rerankerModel: REVERIE_RERANKER_MODEL,
    rerankerTopK: 20,
    rerankerBatchSize: 8,
  };
  try {
    const matches = await reverieSearchSemantic(codexHome, normalized, options);
    return matches.slice(0, limit).map((match) => ({
      conversationId: match.conversation?.id || "unknown",
      timestamp: match.conversation?.createdAt || new Date().toISOString(),
      relevance: typeof match.relevanceScore === "number" ? match.relevanceScore : 0,
      excerpt: match.matchingExcerpts?.[0] || "",
      insights: Array.isArray(match.insights) ? match.insights : [],
    }));
  } catch (error) {
    console.warn(`${LOG_LABEL} Reverie search failed:`, error);
    return [];
  }
}

async function ensureReverieReady(): Promise<void> {
  if (reverieReady) {
    return;
  }
  try {
    await fastEmbedInit({ model: REVERIE_EMBED_MODEL, showDownloadProgress: true });
    reverieReady = true;
  } catch (error) {
    console.warn(`${LOG_LABEL} Failed to initialize reverie embedder:`, error);
  }
}

async function analyzeBranchIntent(
  runner: Runner,
  context: BranchDiffContext,
  branchReveries: ReverieInsight[],
): Promise<BranchIntentPlan> {
  const branchAgent = new Agent<unknown, JsonSchemaDefinition>({
    name: "BranchIntentAnalyzer",
    outputType: BRANCH_PLAN_OUTPUT_TYPE,
    instructions: `# Branch Intent Analyst\n\nYou inspect the diff between a feature branch and its base.\n\nGoals:\n1. Explain the high-level intent for this branch.\n2. Surface 3-8 concrete objectives backing that intent.\n3. Flag architectural or risk issues when the diff looks unnecessary or overly invasive.\n4. Identify which files deserve deeper scrutiny and why.\n\nRespond strictly with JSON matching the provided schema.`,
  });
  const prompt = buildBranchPrompt(context, branchReveries);
  const result = await runner.run(branchAgent, prompt);
  const fallback: BranchIntentPlan = {
    intent_summary: "Unable to infer branch intent.",
    objectives: [],
    risk_flags: [],
    file_focus: context.changedFiles.map((file) => ({ file: file.path, reason: "Changed file", urgency: "medium" })),
  };
  return parseStructuredOutput<BranchIntentPlan>(result.finalOutput, fallback);
}

async function assessFileChange(
  runner: Runner,
  context: BranchDiffContext,
  change: FileChange,
  plan: BranchIntentPlan,
  insights: ReverieInsight[],
): Promise<FileAssessment> {
  const reviewer = new Agent<unknown, JsonSchemaDefinition>({
    name: "FileChangeInspector",
    outputType: FILE_ASSESSMENT_OUTPUT_TYPE,
    instructions: `# File Diff Inspector\n\nJudge whether each change pushes the branch's goals forward.\n- Capture the developer's intent for this file.\n- Decide if the change was necessary, questionable, or unnecessary.\n- Note if it stays minimally invasive (touching only what's needed).\n- List specific unnecessary chunks when you spot churn.\n- Recommend fixes, removals, or follow-ups for risky areas.\n\nRespond as JSON only.`,
  });
  const input = buildFilePrompt(context, change, plan, insights);
  const fallback: FileAssessment = {
    file: change.path,
    change_intent: "",
    necessity: "questionable",
    minimally_invasive: false,
    unnecessary_changes: [],
    recommendations: [],
    risk_level: "info",
  };
  return parseStructuredOutput<FileAssessment>((await runner.run(reviewer, input)).finalOutput, fallback);
}

function buildBranchPrompt(context: BranchDiffContext, insights: ReverieInsight[]): string {
  const filesPreview = context.changedFiles
    .map((file, index) => `${index + 1}. [${file.status}] ${file.path}${file.truncated ? " (diff truncated)" : ""}`)
    .join("\n");
  return [
    `Repo: ${context.repoPath}`,
    `Branch: ${context.branch}`,
    `Base: ${context.baseBranch}`,
    `Merge base: ${context.mergeBase}`,
    ``,
    `Git status:\n${context.statusSummary}`,
    ``,
    `Diff stat:\n${context.diffStat}`,
    ``,
    `Recent commits:\n${context.recentCommits}`,
    ``,
    `Changed files (showing ${context.changedFiles.length} of ${context.totalChangedFiles}):\n${filesPreview}`,
    ``,
    insights.length > 0
      ? `Relevant reveries:\n${formatReveries(insights)}`
      : "No reverie context found.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildFilePrompt(
  context: BranchDiffContext,
  change: FileChange,
  plan: BranchIntentPlan,
  insights: ReverieInsight[],
): string {
  const focusEntry = plan.file_focus.find((entry) => entry.file === change.path);
  return [
    `Branch intent summary: ${plan.intent_summary}`,
    `Objectives:\n${plan.objectives.map((obj) => `- ${obj.title} (${obj.impact_scope}): ${obj.evidence}`).join("\n")}`,
    plan.risk_flags.length > 0 ? `Active risk flags:\n${plan.risk_flags.map((flag) => `- ${flag}`).join("\n")}` : "No branch-level risks recorded.",
    focusEntry ? `Focus guidance for this file:\n${focusEntry.reason} (urgency: ${focusEntry.urgency})` : `File ${change.path} was not explicitly highlighted in the plan.`,
    `File status: ${change.status}${change.previousPath ? ` (from ${change.previousPath})` : ""}`,
    `Diff:\n${change.diff}`,
    insights.length > 0 ? `Reverie matches:\n${formatReveries(insights)}` : "No reverie insight for this file.",
    `Decide necessity + invasiveness for ${change.path} vs base ${context.baseBranch}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseStructuredOutput<T>(value: unknown, fallback: T): T {
  if (value == null) {
    return fallback;
  }
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed as T;
  } catch (error) {
    console.warn(`${LOG_LABEL} Failed to parse structured output`, error);
    return fallback;
  }
}

function renderBranchReport(context: BranchDiffContext, plan: BranchIntentPlan, insights: ReverieInsight[]): void {
  console.log(`\n${LOG_LABEL} Branch Intent Summary`);
  console.log(`Branch ${context.branch} vs ${context.baseBranch} (merge-base ${context.mergeBase})`);
  console.log(`Intent: ${plan.intent_summary || "(missing)"}`);
  if (plan.objectives.length > 0) {
    console.log("Objectives:");
    plan.objectives.forEach((obj, idx) => {
      console.log(`  ${idx + 1}. ${obj.title} [${obj.impact_scope}] - ${obj.evidence}`);
    });
  }
  if (plan.risk_flags.length > 0) {
    console.log("Risks:");
    plan.risk_flags.forEach((flag) => console.log(`  - ${flag}`));
  }
  if (plan.file_focus.length > 0) {
    console.log("Focus files:");
    plan.file_focus.forEach((entry) => {
      console.log(`  - ${entry.file}: ${entry.reason} (urgency: ${entry.urgency})`);
    });
  }
  if (insights.length > 0) {
    console.log("Reverie highlights:");
    insights.slice(0, 3).forEach((match) => {
      console.log(`  - ${match.insights.join("; ") || match.excerpt} (${Math.round(match.relevance * 100)}%)`);
    });
  }
}

function renderFileAssessment(assessment: FileAssessment, change: FileChange, insights: ReverieInsight[]): void {
  console.log(`\n${LOG_LABEL} File: ${assessment.file}`);
  console.log(`Status: ${change.status}${change.previousPath ? ` (from ${change.previousPath})` : ""}`);
  console.log(`Intent: ${assessment.change_intent || "(not captured)"}`);
  console.log(`Necessity: ${assessment.necessity} | Minimally invasive: ${assessment.minimally_invasive ? "yes" : "no"} | Risk: ${assessment.risk_level}`);
  if (assessment.unnecessary_changes.length > 0) {
    console.log("Unnecessary changes:");
    assessment.unnecessary_changes.forEach((item) => console.log(`  - ${item}`));
  }
  if (assessment.recommendations.length > 0) {
    console.log("Recommendations:");
    assessment.recommendations.forEach((item) => console.log(`  - ${item}`));
  }
  if (insights.length > 0) {
    console.log("Reverie cues:");
    insights.slice(0, 2).forEach((match) => {
      console.log(`  - ${match.insights.join("; ") || match.excerpt} (${Math.round(match.relevance * 100)}%)`);
    });
  }
}

function formatReveries(matches: ReverieInsight[]): string {
  return matches
    .map((match, idx) => {
      const title = match.insights[0] || match.excerpt || "Insight";
      return `#${idx + 1} (${Math.round(match.relevance * 100)}%) ${title}`;
    })
    .join("\n");
}

function assertRepo(candidate: string): string {
  const repo = path.resolve(candidate);
  if (!fs.existsSync(path.join(repo, ".git"))) {
    throw new Error(`Repository not found at ${repo}`);
  }
  return repo;
}

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
