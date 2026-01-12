fn registered_native_tools() -> &'static Mutex<Vec<ExternalToolRegistration>> {
  static TOOLS: OnceLock<Mutex<Vec<ExternalToolRegistration>>> = OnceLock::new();
  TOOLS.get_or_init(|| Mutex::new(Vec::new()))
}

// Store JS callbacks for test-only invocation so JS can verify payloads are delivered
// without needing a full Codex session. This reuses the same threadsafe function
// created during register_tool, ensuring the call path matches production.
type ToolTsfn = Arc<
  ThreadsafeFunction<
    JsToolInvocation,
    NativeToolResponse,
    JsToolInvocation,
    napi::Status,
    false,
  >,
>;

fn test_tool_callbacks() -> &'static Mutex<HashMap<String, ToolTsfn>> {
  static CALLBACKS: OnceLock<Mutex<HashMap<String, ToolTsfn>>> = OnceLock::new();
  CALLBACKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn registered_tool_infos() -> &'static Mutex<Vec<NativeToolInfo>> {
  static TOOLS: OnceLock<Mutex<Vec<NativeToolInfo>>> = OnceLock::new();
  TOOLS.get_or_init(|| Mutex::new(Vec::new()))
}

fn pending_plan_updates()
-> &'static Mutex<HashMap<String, codex_protocol::plan_tool::UpdatePlanArgs>> {
  static UPDATES: OnceLock<Mutex<HashMap<String, codex_protocol::plan_tool::UpdatePlanArgs>>> =
    OnceLock::new();
  UPDATES.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone)]
#[allow(dead_code)]
struct NativeToolInterceptor {
  tool_name: String,
  handler: Arc<dyn ToolInterceptor>,
}

fn registered_native_interceptors() -> &'static Mutex<Vec<NativeToolInterceptor>> {
  static INTERCEPTORS: OnceLock<Mutex<Vec<NativeToolInterceptor>>> = OnceLock::new();
  INTERCEPTORS.get_or_init(|| Mutex::new(Vec::new()))
}

type InterceptorFuture =
  Pin<Box<dyn Future<Output = Result<ToolOutput, FunctionCallError>> + Send>>;

trait NextCaller: Send {
  fn call(self: Box<Self>, invocation: ToolInvocation) -> InterceptorFuture;
}

impl<F> NextCaller for F
where
  F: FnOnce(ToolInvocation) -> InterceptorFuture + Send + 'static,
{
  fn call(self: Box<Self>, invocation: ToolInvocation) -> InterceptorFuture {
    (*self)(invocation)
  }
}

struct PendingBuiltinCall {
  invocation: ToolInvocation,
  next: Option<Box<dyn NextCaller>>,
}

fn pending_builtin_calls() -> &'static Mutex<HashMap<String, PendingBuiltinCall>> {
  static CALLS: OnceLock<Mutex<HashMap<String, PendingBuiltinCall>>> = OnceLock::new();
  CALLS.get_or_init(|| Mutex::new(HashMap::new()))
}

type ThreadEventHandler = Arc<Mutex<Box<dyn FnMut(ExecThreadEvent) + Send>>>;

fn active_thread_handlers() -> &'static Mutex<HashMap<String, ThreadEventHandler>> {
  static HANDLERS: OnceLock<Mutex<HashMap<String, ThreadEventHandler>>> = OnceLock::new();
  HANDLERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_thread_handler(thread_id: &str, handler: &ThreadEventHandler) {
  if let Ok(mut map) = active_thread_handlers().lock() {
    map.insert(thread_id.to_string(), Arc::clone(handler));
  }
}

fn unregister_thread_handler(thread_id: &str) {
  if let Ok(mut map) = active_thread_handlers().lock() {
    map.remove(thread_id);
  }
}

fn dispatch_thread_event(handler: &ThreadEventHandler, event: ExecThreadEvent) -> napi::Result<()> {
  let mut guard = handler
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("thread handler mutex poisoned: {e}")))?;
  (*guard)(event);
  Ok(())
}

fn cleanup_thread_handler(slot: &Arc<Mutex<Option<String>>>) {
  if let Ok(mut guard) = slot.lock()
    && let Some(id) = guard.take() {
      unregister_thread_handler(&id);
  }
}

