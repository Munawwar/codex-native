# Agent Merge Workflow

This package implements the agent-based merge solver used by `merge-solver-cli`.

Pipeline
1. **Coordinator (agent)**: Builds a global merge plan from the repo snapshot (conflicts + remote comparison).
2. **Workers (agents)**: Resolve conflicts; model chosen dynamically (high/low/default). If a conflict remains or is complex, we delegate to **OpenCode**.
3. **OpenCode (Codex thread)**: High‑reasoning, tool-capable pass guarded by the Approval Supervisor.
4. **Reviewer (agent)**: Summarises outcomes; final success requires git to report zero conflicts.

Approvals
- An ApprovalSupervisor thread is created up front and used to gate OpenCode runs; coordinator plan is logged to the supervisor context thread for situational awareness.

Concurrency
- Simple conflicts run with `maxConcurrentSimpleWorkers`; complex conflicts are processed sequentially via OpenCode.

Notes / TODO
- Wire agent tool execution end-to-end so workers can edit files directly.
- Add validation pass and richer reviewer inputs (live status/diffstat).
- Expand tests beyond model selection (orchestrator happy-path + OpenCode fallback).
