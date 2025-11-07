#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { Codex } from "@codex-native/sdk";

const DEFAULT_REMOTE = "origin";
const DEFAULT_CONCURRENCY = Math.max(os.cpus().length - 1, 1);

async function main() {
  const config = await buildConfig();

  await ensureBinaryAvailable("git");
  await ensureBinaryAvailable("gh");
  await ensureBinaryAvailable("pnpm");

  await fs.mkdir(config.worktreeRoot, { recursive: true });

  const prs = await listOpenPullRequests(config);
  if (prs.length === 0) {
    console.log("No open pull requests detected. Nothing to do.");
    return;
  }

  console.log(`Discovered ${prs.length} open pull request${prs.length === 1 ? "" : "s"}.`);

  const existingWorktrees = await getExistingWorktreePaths(config.repoRoot);
  const createdWorktrees = new Set();
  const gitMutex = createMutex();
  const installMutex = createMutex();

  const results = await runWithConcurrency(prs, config.concurrency, async (pr) => {
    const safeSlug = slugifyRef(pr.headRefName) || `head-${pr.number}`;
    const worktreeDir = `pr-${pr.number}-${safeSlug}`;
    const worktreePath = path.join(config.worktreeRoot, worktreeDir);
    const remoteRef = `refs/remotes/${config.remote}/pr-worktree/${pr.number}`;
    let createdWorktree = false;

    try {
      await gitMutex.run(async () => {
        await runCommand("git", [
          "fetch",
          "--force",
          config.remote,
          `pull/${pr.number}/head:${remoteRef}`,
        ], { cwd: config.repoRoot });

        const knownWorktree = existingWorktrees.has(worktreePath);
        const pathAlreadyExists = await pathExists(worktreePath);

        if (!knownWorktree && pathAlreadyExists) {
          // Remove stale directory so worktree add succeeds.
          await fs.rm(worktreePath, { recursive: true, force: true });
        }

        if (!knownWorktree) {
          await runCommand("git", [
            "worktree",
            "add",
            "--force",
            "--detach",
            worktreePath,
            remoteRef,
          ], { cwd: config.repoRoot });
          existingWorktrees.add(worktreePath);
          createdWorktrees.add(worktreePath);
          console.log(`[PR ${pr.number}] Created worktree at ${worktreePath}`);
          createdWorktree = true;
        } else {
          await runCommand("git", ["reset", "--hard", remoteRef], { cwd: worktreePath });
          await runCommand("git", ["clean", "-fdx"], { cwd: worktreePath });
          console.log(`[PR ${pr.number}] Refreshed existing worktree at ${worktreePath}`);
        }

        await runCommand("git", ["checkout", "-B", pr.headRefName, remoteRef], { cwd: worktreePath });
      });
    } catch (error) {
      console.error(`[PR ${pr.number}] Failed to prepare worktree:`, error);
      return { pr, worktreePath, error };
    }

    const needsInstall = createdWorktree || !(await pathExists(path.join(worktreePath, "node_modules")));

    if (needsInstall) {
      try {
        console.log(`[PR ${pr.number}] Running pnpm install...`);
        await installMutex.run(async () => {
          await runCommand("pnpm", ["install"], { cwd: worktreePath });
        });
      } catch (error) {
        console.error(`[PR ${pr.number}] pnpm install failed:`, error);
        return { pr, worktreePath, error };
      }
    }

    if (config.dryRun) {
      console.log(`[PR ${pr.number}] Dry run enabled; skipping Codex automation.`);
      return { pr, worktreePath, dryRun: true };
    }

    try {
      const codex = new Codex();
      const basePrefix = formatPrefix(pr);

      const mergeThread = codex.startThread({
        workingDirectory: worktreePath,
        sandboxMode: "workspace-write",
        fullAuto: true,
      });

      const mergePrefix = `${basePrefix} [merge]`;
      const mergePrompt = buildMergePrompt(pr, worktreePath);
      logWithPrefix(mergePrefix, "Starting Codex merge turn...");

      const mergeTurn = await runCodexTurnWithLogging(mergeThread, mergePrompt, mergePrefix);

      logWithPrefix(mergePrefix, "Merge summary:");
      logWithPrefix(mergePrefix, mergeTurn.finalResponse.trim());

      const fixThread = codex.startThread({
        workingDirectory: worktreePath,
        sandboxMode: "workspace-write",
        fullAuto: true,
      });

      const fixPrefix = `${basePrefix} [checks]`;
      const fixPrompt = buildFixPrompt(pr, worktreePath);
      logWithPrefix(fixPrefix, "Starting Codex checks turn...");

      const fixTurn = await runCodexTurnWithLogging(fixThread, fixPrompt, fixPrefix);

      logWithPrefix(fixPrefix, "Checks summary:");
      logWithPrefix(fixPrefix, fixTurn.finalResponse.trim());

      return { pr, worktreePath, mergeTurn, fixTurn };
    } catch (error) {
      console.error(`[PR ${pr.number}] Codex automation failed:`, error);
      return { pr, worktreePath, error };
    }
  });

  const pushOutcomes = [];
  for (const result of results) {
    if (!result || result.error || result.dryRun) {
      continue;
    }

    try {
      await ensurePushed(result.pr, result.worktreePath, config.remote);
      pushOutcomes.push({ pr: result.pr, success: true });
    } catch (error) {
      pushOutcomes.push({ pr: result.pr, success: false, error });
      console.error(`[PR ${result.pr.number}] Post-run push failed:`, error);
    }
  }

  const cleanupOutcomes = [];
  for (const worktreePath of createdWorktrees) {
    try {
      await runCommand("git", ["worktree", "remove", "--force", worktreePath], { cwd: config.repoRoot });
      cleanupOutcomes.push({ path: worktreePath, success: true });
    } catch (error) {
      cleanupOutcomes.push({ path: worktreePath, success: false, error });
      console.error(`Failed to clean worktree ${worktreePath}:`, error);
    }
  }

  summarizeResults(results, pushOutcomes, cleanupOutcomes);
}

async function buildConfig() {
  const args = process.argv.slice(2);
  let repoRoot = process.cwd();
  let worktreeRoot = path.resolve(repoRoot, "..", "codex-pr-worktrees");
  let concurrency = DEFAULT_CONCURRENCY;
  let remote = DEFAULT_REMOTE;
  let dryRun = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--repo": {
        const value = args[i + 1];
        if (!value) {
          throw new Error("--repo flag requires a path argument");
        }
        repoRoot = path.resolve(value);
        i += 1;
        break;
      }
      case "--worktree-root": {
        const value = args[i + 1];
        if (!value) {
          throw new Error("--worktree-root flag requires a path argument");
        }
        worktreeRoot = path.resolve(value);
        i += 1;
        break;
      }
      case "--concurrency": {
        const value = Number(args[i + 1]);
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error("--concurrency flag requires a positive integer");
        }
        concurrency = Math.floor(value);
        i += 1;
        break;
      }
      case "--remote": {
        const value = args[i + 1];
        if (!value) {
          throw new Error("--remote flag requires a remote name");
        }
        remote = value;
        i += 1;
        break;
      }
      case "--dry-run":
        dryRun = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          console.warn(`Unknown option ${arg} (ignored).`);
        }
        break;
    }
  }

  return { repoRoot, worktreeRoot, concurrency, remote, dryRun };
}

function printUsage() {
  console.log(`Usage: node pr-worktree-codex.mjs [options]

Options:
  --repo <path>            Override repository root (default: current directory)
  --worktree-root <path>   Directory to place PR worktrees (default: ../codex-pr-worktrees)
  --remote <name>          Remote to fetch pull requests from (default: origin)
  --concurrency <n>        Maximum concurrent Codex runs (default: cpu count - 1)
  --dry-run                Prepare worktrees without invoking Codex
  --help                   Show this message
`);
}

async function ensureBinaryAvailable(binary) {
  try {
    await runCommand(binary, ["--version"]);
  } catch (error) {
    throw new Error(`Required binary '${binary}' is not available in PATH`);
  }
}

async function listOpenPullRequests(config) {
  const jsonFields = [
    "number",
    "title",
    "headRefName",
    "headRepository",
    "headRepositoryOwner",
    "url",
  ];

  const args = [
    "pr",
    "list",
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    jsonFields.join(","),
  ];

  const { stdout } = await runCommand("gh", args, { cwd: config.repoRoot });
  const parsed = JSON.parse(stdout);

  return parsed.map((entry) => ({
    number: entry.number,
    title: entry.title,
    headRefName: entry.headRefName,
    headRepository: entry.headRepository ?? null,
    headRepositoryOwner: entry.headRepositoryOwner ?? null,
    url: entry.url,
  }));
}

async function getExistingWorktreePaths(repoRoot) {
  const { stdout } = await runCommand("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot });

  const blocks = stdout.split(/\n(?=worktree )/).map((block) => block.trim()).filter(Boolean);
  const paths = new Set();

  for (const block of blocks) {
    for (const line of block.split("\n")) {
      if (line.startsWith("worktree ")) {
        const worktreePath = line.substring("worktree ".length).trim();
        paths.add(path.resolve(worktreePath));
      }
    }
  }

  return paths;
}

function createMutex() {
  let chain = Promise.resolve();
  return {
    run(fn) {
      const next = chain.then(() => fn());
      chain = next.catch(() => {});
      return next;
    },
  };
}

async function runWithConcurrency(items, concurrency, handler) {
  if (items.length === 0) {
    return [];
  }

  const effectiveConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) {
        break;
      }
      results[currentIndex] = await handler(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: effectiveConcurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

function slugifyRef(ref) {
  return ref.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function buildMergePrompt(pr, worktreePath) {
  return [
    `You are a Codex automation agent working inside ${worktreePath}.`,
    "First, ensure the branch is fully up to date with the latest main branch.",
    "Steps:",
    "1. Run 'git status' to confirm the working tree is clean (resolve or stash anything unexpected).",
    "2. Fetch the latest main branch with 'git fetch origin main'.",
    "3. Merge main into this branch with 'git merge origin/main', resolving any conflicts. Prefer keeping the branch's intent while incorporating upstream fixes.",
    "4. After resolving conflicts, run appropriate builds/tests if necessary to ensure the merge succeeded.",
    "5. Commit the merge (or conflict resolutions) with a clear message if new commits are created.",
    "6. Provide a brief summary of the merge result, noting any conflicts handled.",
    "Do not push yet; that will happen after checks pass.",
  ].join("\n");
}

function buildFixPrompt(pr, worktreePath) {
  return [
    `You are an automated Codex maintainer responsible for validating pull request #${pr.number}.`,
    `The worktree directory is ${worktreePath}.`,
    `Tasks:`,
    "1. Run 'gh pr checks --watch " + pr.number + "' from the repository root to monitor CI failures until they are resolved.",
    "2. Investigate failing checks, apply fixes, and commit the necessary changes with clear messages.",
    "3. Push your commits back to the PR branch (" + pr.headRefName + ") once checks succeed.",
    "4. Provide a final summary including CI status, tests executed, and any remaining manual actions.",
    "Use shell commands responsibly and ensure no failing checks remain before finishing.",
  ].join("\n");
}

async function ensurePushed(pr, worktreePath, remote) {
  await runCommand("git", ["add", "-A"], { cwd: worktreePath });

  try {
    await runCommand("git", ["commit", "-m", `chore: codex fixes for PR #${pr.number}`], { cwd: worktreePath });
  } catch (error) {
    if (!isNothingToCommit(error)) {
      throw error;
    }
  }

  try {
    await runCommand("git", ["push", "--set-upstream", remote, pr.headRefName], { cwd: worktreePath });
  } catch (error) {
    const message = `${error.stderr ?? ""}${error.stdout ?? ""}`;
    if (/set-upstream/.test(message) || /already exists/.test(message) || /set upstream/.test(message)) {
      await runCommand("git", ["push", remote, pr.headRefName], { cwd: worktreePath });
      return;
    }
    throw error;
  }
}

function isNothingToCommit(error) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const text = `${error.stderr ?? ""}${error.stdout ?? ""}`;
  return /nothing to commit/i.test(text);
}

function formatPrefix(pr) {
  return `[PR ${pr.number} ${pr.headRefName}]`;
}

function logWithPrefix(prefix, message) {
  for (const line of message.split("\n")) {
    console.log(`${prefix} ${line}`);
  }
}

async function runCodexTurnWithLogging(thread, prompt, prefix) {
  const { events } = await thread.runStreamed(prompt);
  const items = new Map();
  let finalResponse = "";
  let usage = null;

  try {
    for await (const event of events) {
      handleEventLogging(event, prefix);

      switch (event.type) {
        case "item.started":
        case "item.updated":
        case "item.completed":
          if (event.item) {
            items.set(event.item.id, event.item);
            if (event.item.type === "agent_message") {
              finalResponse = event.item.text;
            }
          }
          break;
        case "turn.completed":
          usage = event.usage ?? null;
          break;
        case "turn.failed":
          throw new Error(event.error?.message ?? "Codex turn failed");
        case "error":
          throw new Error(event.message ?? "Codex stream error");
        default:
          break;
      }
    }
  } catch (error) {
    logWithPrefix(prefix, `Codex stream aborted: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  return {
    finalResponse,
    items: Array.from(items.values()),
    usage,
  };
}

function handleEventLogging(event, prefix) {
  switch (event.type) {
    case "thread.started":
      logWithPrefix(prefix, `Thread started (${event.thread_id})`);
      break;
    case "turn.started":
      logWithPrefix(prefix, "Turn started");
      break;
    case "turn.completed":
      logWithPrefix(prefix, formatUsage(event.usage));
      break;
    case "turn.failed":
      logWithPrefix(prefix, `Turn failed: ${event.error?.message ?? "unknown error"}`);
      break;
    case "item.started":
      logWithPrefix(prefix, formatItem("started", event.item));
      break;
    case "item.updated":
      logWithPrefix(prefix, formatItem("updated", event.item));
      break;
    case "item.completed":
      logWithPrefix(prefix, formatItem("completed", event.item));
      break;
    case "error":
      logWithPrefix(prefix, `Stream error: ${event.message}`);
      break;
    case "exited_review_mode":
      logWithPrefix(prefix, "Exited review mode");
      break;
    default:
      break;
  }
}

function formatUsage(usage) {
  if (!usage) {
    return "Turn completed";
  }
  return `Turn completed (usage: in=${usage.input_tokens ?? 0}, cached=${usage.cached_input_tokens ?? 0}, out=${usage.output_tokens ?? 0})`;
}

function formatItem(phase, item) {
  if (!item) {
    return `Item ${phase}`;
  }

  switch (item.type) {
    case "agent_message":
      return `Item ${phase} — agent_message: ${truncate(item.text, 200)}`;
    case "command_execution":
      return `Item ${phase} — command: ${item.command} [${item.status}]`;
    case "file_change":
      return `Item ${phase} — file_change: ${item.changes.length} files (${item.status})`;
    case "mcp_tool_call":
      return `Item ${phase} — mcp ${item.server}::${item.tool} [${item.status}]`;
    case "todo_list":
      return `Item ${phase} — todo_list (${item.items.length} entries)`;
    case "error":
      return `Item ${phase} — error: ${item.message}`;
    case "web_search":
      return `Item ${phase} — web_search: ${item.query}`;
    default:
      return `Item ${phase} — ${item.type}`;
  }
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text ?? "";
  }
  return `${text.slice(0, maxLength)}…`;
}

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function summarizeResults(results, pushOutcomes, cleanupOutcomes) {
  const agentSuccesses = [];
  const agentFailures = [];
  const dryRuns = [];

  for (const result of results) {
    if (!result) {
      continue;
    }

    if (result.dryRun) {
      dryRuns.push(result.pr.number);
    } else if (result.error) {
      const message = result.error instanceof Error ? result.error.message : String(result.error);
      agentFailures.push({ number: result.pr.number, message });
    } else {
      agentSuccesses.push(result.pr.number);
    }
  }

  console.log("\n=== Summary ===");

  if (agentSuccesses.length) {
    console.log(`Codex processed PRs: ${agentSuccesses.join(", ")}`);
  }

  if (dryRuns.length) {
    console.log(`Dry run only (no Codex execution): ${dryRuns.join(", ")}`);
  }

  if (agentFailures.length) {
    console.log("Codex failures:");
    for (const failure of agentFailures) {
      console.log(`- PR ${failure.number}: ${failure.message}`);
    }
  }

  const pushFailures = pushOutcomes.filter((outcome) => !outcome.success);
  if (pushFailures.length) {
    console.log("Push failures:");
    for (const failure of pushFailures) {
      const message = failure.error instanceof Error ? failure.error.message : String(failure.error);
      console.log(`- PR ${failure.pr.number}: ${message}`);
    }
  }

  const cleanupFailures = cleanupOutcomes.filter((outcome) => !outcome.success);
  if (cleanupFailures.length) {
    console.log("Cleanup failures:");
    for (const failure of cleanupFailures) {
      const message = failure.error instanceof Error ? failure.error.message : String(failure.error);
      console.log(`- ${failure.path}: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});


