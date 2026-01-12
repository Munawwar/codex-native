// Section 2: Tool Registration and Interceptors
// ============================================================================
//
// This section provides functionality for registering custom tools and
// interceptors from JavaScript/TypeScript code. Tools can replace or augment
// built-in Codex tools, and interceptors can modify tool invocations.
//
// Key exports:
//   - clear_registered_tools()
//   - register_tool()
//   - register_tool_interceptor()
//   - register_approval_callback()
//
// ============================================================================

include!("exports.rs");
include!("state.rs");
include!("types.rs");
include!("js_handlers.rs");
include!("tests.rs");
