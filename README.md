<p align="center"><code>npm i -g @openai/codex</code><br />or <code>brew install --cask codex</code></p>
<p align="center"><strong>Codex CLI</strong> is a coding agent from OpenAI that runs locally on your computer.
<p align="center">
  <img src="https://github.com/openai/codex/blob/main/.github/codex-cli-splash.png" alt="Codex CLI splash" width="80%" />
</p>
</br>
If you want Codex in your code editor (VS Code, Cursor, Windsurf), <a href="https://developers.openai.com/codex/ide">install in your IDE.</a>
</br>If you are looking for the <em>cloud-based agent</em> from OpenAI, <strong>Codex Web</strong>, go to <a href="https://chatgpt.com/codex">chatgpt.com/codex</a>.</p>

---

## What this fork adds over the official Codex CLI

This is a fork of the [official OpenAI Codex CLI](https://github.com/openai/codex) by [ScriptedAlchemy](https://github.com/ScriptedAlchemy) (Zack Jackson, creator of Module Federation). It transforms Codex from a standalone terminal tool into an **embeddable, programmable agent platform**. The fork is actively maintained and regularly syncs with upstream.

### 1. Native Node.js SDK with Rust NAPI Bindings (`sdk/native/`)

**Package**: `@codex-native/sdk`

Embeds the Codex Rust runtime directly into Node.js via [napi-rs](https://napi.rs/) instead of spawning child processes. Key capabilities:

- **Thread management** -- `startThread()`, `run()`, `runStreamed()`, `resumeThread()`, `fork()`
- **Custom tool registration** -- Register JS functions as tools the AI can invoke, including overriding built-in tools (`shell`, `apply_patch`, `read_file`, etc.)
- **Tool interceptors** -- Wrap built-in tools with pre/post-processing logic
- **Structured output** -- JSON schema validation for model responses
- **Streaming** -- Async generator-based event streaming powered by the Tokio runtime
- **Programmatic code review** -- `codex.review()` API for diff review against branches, commits, or custom prompts
- **Conversation forking** -- Branch from earlier messages to explore alternate paths
- **Skills system** -- Register named skills programmatically (no SKILL.md files needed)
- **Approval callbacks** -- JavaScript-side approval gating for sensitive operations
- **Cross-platform** -- macOS (arm64/x64), Linux (x64/arm64, glibc/musl), Windows (x64/arm64)

### 2. OpenAI Agents Framework Integration

A full `ModelProvider` implementation (`CodexProvider`) for the [OpenAI Agents JS SDK](https://github.com/openai/openai-agents-js). This allows using the Codex runtime as the execution backend for the OpenAI Agents framework:

```typescript
import { CodexProvider } from "@codex-native/sdk";
import { Agent, run } from "@openai/agents";

const provider = new CodexProvider({ defaultModel: "gpt-5.1-codex" });
const agent = new Agent({
  name: "CodeAssistant",
  model: provider.getModel(),
  instructions: "Fix the failing tests",
});
const result = await run(agent, "Investigate the CI failure");
```

Features include buffered and streamed model responses, thread continuity, tool execution inside the Codex sandbox, and a tool registry for mapping Codex tools to the Agents framework.

### 3. GitHub Copilot / OpenCode Model Provider

Allows authenticating via GitHub Copilot tokens to use models (including GPT-5) through the Copilot API, without requiring a direct OpenAI API key.

### 4. Enhanced Reverie (Conversation History Search)

Major improvements to the Reverie system -- Codex's semantic memory for past conversations:

- **Multi-vector embeddings** with max-pooling for per-message precision
- **Query expansion** with 60+ technical synonym mappings
- **Hybrid scoring** -- 70% semantic similarity + 30% keyword relevance
- **Embedding-based quality filtering** replacing hardcoded pattern matching
- **Multi-stage pipeline** -- Search → Quality Filter → Score Split → LLM Grade → Deduplicate
- **Multi-level search** -- Project-wide, branch-specific, and file-specific tiers
- **+35% improvement** in average search relevance (58% → 78.5%)

### 5. Codex Agents Suite (`codex-agents-suite/`)

A higher-level multi-agent workflow toolkit providing four turnkey workflows:

- **PR Review & CI Orchestrator** -- End-to-end review, CI triage, reverie hints, optional auto-fix
- **Diff Reviewer** -- Structured diff analysis with per-file risk scoring and LSP diagnostics
- **Merge Conflict Solver** -- Autonomous merge with coordinator/worker/reviewer pipeline and supervisor approval
- **CI Auto-Fix Orchestrator** -- Iterative fix-and-rerun loop with bounded concurrency

### 6. LSP Integration (`sdk/native/src/lsp/`)

An LSP client that collects diagnostics (type errors, lint warnings) from language servers (TypeScript, Pyright, etc.) during agent execution, enriching tool outputs with compiler/linter data.

### 7. PR Worktree Automation

Scripts for automated PR review workflows using git worktrees.

---

## Quickstart

### Installing and running Codex CLI

Install globally with your preferred package manager:

```shell
# Install using npm
npm install -g @openai/codex
```

```shell
# Install using Homebrew
brew install --cask codex
```

Then simply run `codex` to get started.

<details>
<summary>You can also go to the <a href="https://github.com/openai/codex/releases/latest">latest GitHub Release</a> and download the appropriate binary for your platform.</summary>

Each GitHub Release contains many executables, but in practice, you likely want one of these:

- macOS
  - Apple Silicon/arm64: `codex-aarch64-apple-darwin.tar.gz`
  - x86_64 (older Mac hardware): `codex-x86_64-apple-darwin.tar.gz`
- Linux
  - x86_64: `codex-x86_64-unknown-linux-musl.tar.gz`
  - arm64: `codex-aarch64-unknown-linux-musl.tar.gz`

Each archive contains a single entry with the platform baked into the name (e.g., `codex-x86_64-unknown-linux-musl`), so you likely want to rename it to `codex` after extracting it.

</details>

### Using Codex with your ChatGPT plan

Run `codex` and select **Sign in with ChatGPT**. We recommend signing into your ChatGPT account to use Codex as part of your Plus, Pro, Team, Edu, or Enterprise plan. [Learn more about what's included in your ChatGPT plan](https://help.openai.com/en/articles/11369540-codex-in-chatgpt).

You can also use Codex with an API key, but this requires [additional setup](https://developers.openai.com/codex/auth#sign-in-with-an-api-key).

## Docs

- [**Codex Documentation**](https://developers.openai.com/codex)
- [**Contributing**](./docs/contributing.md)
- [**Installing & building**](./docs/install.md)
- [**Open source fund**](./docs/open-source-fund.md)

This repository is licensed under the [Apache-2.0 License](LICENSE).
