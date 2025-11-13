#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import packageJson from "../../package.json";
import { Codex } from "../codex";
import { attachLspDiagnostics } from "../lsp";
import type { LspManagerOptions } from "../lsp";
import type { ThreadOptions } from "../threadOptions";
import { parseApprovalModeFlag, parseSandboxModeFlag } from "./optionParsers";

const OPTION_DEFS = {
  help: { type: "boolean" } as const,
  version: { type: "boolean" } as const,
  model: { type: "string" } as const,
  oss: { type: "boolean" } as const,
  sandbox: { type: "string" } as const,
  approval: { type: "string" } as const,
  prompt: { type: "string" } as const,
  "working-directory": { type: "string" } as const,
  "skip-git-repo-check": { type: "boolean" } as const,
  "base-url": { type: "string" } as const,
  "api-key": { type: "string" } as const,
  "no-lsp": { type: "boolean" } as const,
  "lsp-no-wait": { type: "boolean" } as const,
} as const;

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rawArgs,
    options: OPTION_DEFS,
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  if (values.version) {
    console.log(packageJson.version);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("The interactive TUI requires an interactive terminal (TTY).");
  }

  const promptValue =
    typeof values.prompt === "string"
      ? values.prompt
      : positionals.length > 0
        ? positionals.join(" ")
        : undefined;
  const prompt = promptValue && promptValue.trim().length > 0 ? promptValue.trim() : undefined;

  const workingDirectoryInput =
    typeof values["working-directory"] === "string"
      ? values["working-directory"]
      : process.cwd();
  const workingDirectory = path.resolve(workingDirectoryInput);
  const skipGitRepoCheck = values["skip-git-repo-check"] === true;

  const sandboxMode = parseSandboxModeFlag(
    typeof values.sandbox === "string" ? values.sandbox : undefined,
    "--sandbox",
  );
  const approvalMode = parseApprovalModeFlag(
    typeof values.approval === "string" ? values.approval : undefined,
    "--approval",
  );

  const threadOptions: ThreadOptions = {
    model: typeof values.model === "string" ? values.model : undefined,
    oss: values.oss === true ? true : undefined,
    sandboxMode,
    approvalMode,
    workingDirectory,
    skipGitRepoCheck,
  };

  const codex = new Codex({
    baseUrl: typeof values["base-url"] === "string" ? values["base-url"] : undefined,
    apiKey: typeof values["api-key"] === "string" ? values["api-key"] : undefined,
  });

  const thread = codex.startThread(threadOptions);

  const enableLsp = values["no-lsp"] !== true;
  const lspOptions: LspManagerOptions = {
    workingDirectory,
    waitForDiagnostics: values["lsp-no-wait"] === true ? false : true,
  };

  const detachLsp = enableLsp ? attachLspDiagnostics(thread, lspOptions) : undefined;

  try {
    if (prompt) {
      await thread.tui({ prompt });
    } else {
      await thread.tui();
    }
  } finally {
    detachLsp?.();
  }
}

function printHelp(): void {
  console.log(`codex-agent v${packageJson.version}

Usage:
  codex-agent [options] [prompt]

Options:
  --model <slug>               Model slug to use for the default thread
  --oss                        Enable OSS provider mode (requires gpt-oss:* models)
  --sandbox <mode>             Sandbox mode (read-only | workspace-write | danger-full-access)
  --approval <policy>          Approval policy (never | on-request | on-failure | untrusted)
  --prompt <text>              Initial prompt to seed the TUI session
  --working-directory <path>   Working directory for the agent (defaults to current dir)
  --skip-git-repo-check        Skip git repository safety checks
  --base-url <url>             Override Codex API base URL
  --api-key <key>              API key for Codex requests
  --no-lsp                     Disable the LSP diagnostics bridge
  --lsp-no-wait                Do not wait for diagnostics before showing results
  --help                       Show this help message
  --version                    Print version information
`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (process.env.CODEX_NATIVE_DEBUG) {
      console.error(error.stack);
    }
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
});

