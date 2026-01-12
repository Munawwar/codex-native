// Section 3: Run Request Handling (Thread Execution)
// ============================================================================
//
// This section handles execution of agent threads, including:
//   - RunRequest: Configuration for agent execution
//   - Thread streaming and event handling
//   - Compaction of conversation history
//
// Key exports:
//   - run_thread(): Execute agent with given configuration
//   - run_thread_stream(): Stream events during execution
//   - compact_thread(): Compact conversation history
//
// ============================================================================

include!("types.rs");
include!("model_validation.rs");
include!("parsing.rs");
include!("cli_builder.rs");
include!("schema.rs");
include!("env_overrides.rs");
include!("tui_snapshots.rs");
include!("thread_ops.rs");
include!("execution.rs");
include!("cloud_client.rs");
include!("tests.rs");
