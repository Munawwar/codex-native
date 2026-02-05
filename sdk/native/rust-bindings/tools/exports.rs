#[derive(Clone)]
#[napi(object)]
pub struct NativeToolInfo {
  pub name: String,
  pub description: Option<String>,
  pub parameters: Option<JsonValue>,
  pub strict: Option<bool>,
  pub supports_parallel: Option<bool>,
}

#[derive(Clone)]
#[napi(object)]
pub struct NativeToolResponse {
  pub output: Option<String>,
  pub success: Option<bool>,
  pub error: Option<String>,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsEmitBackgroundEventRequest {
  #[napi(js_name = "threadId")]
  pub thread_id: String,
  pub message: String,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsEmitPlanUpdateRequest {
  pub thread_id: String,
  pub explanation: Option<String>,
  pub plan: Vec<JsPlanItem>,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsPlanItem {
  pub step: String,
  pub status: Option<String>, // "pending", "in_progress", "completed"
}

#[derive(Clone)]
#[napi(object)]
pub struct JsModifyPlanRequest {
  pub thread_id: String,
  pub operations: Vec<JsPlanOperation>,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsPlanOperation {
  pub type_: String, // "add", "update", "remove", "reorder"
  pub item: Option<JsPlanItem>,
  pub index: Option<i32>,
  pub updates: Option<JsPlanUpdate>,
  pub new_order: Option<Vec<i32>>,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsPlanUpdate {
  pub step: Option<String>,
  pub status: Option<String>,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsToolInterceptorContext {
  pub invocation: JsToolInvocation,
  pub token: String,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsApprovalRequest {
  #[napi(js_name = "type")]
  pub type_: String,
  pub details: Option<JsonValue>,
}

#[derive(Clone)]
#[napi(object)]
pub struct JsToolInvocation {
  #[napi(js_name = "callId")]
  pub call_id: String,
  #[napi(js_name = "toolName")]
  pub tool_name: String,
  #[napi(js_name = "arguments")]
  pub arguments: Option<String>,
  pub input: Option<String>,
}

// Order matters: `Either` tries variants in order. Promises are also JS objects,
// so we must try `Promise<T>` before attempting to decode as the plain object.
type ToolHandlerReturn =
  napi::Either<napi::bindgen_prelude::Promise<NativeToolResponse>, NativeToolResponse>;
type ApprovalHandlerReturn = napi::Either<napi::bindgen_prelude::Promise<bool>, bool>;

struct JsToolHandler {
  // NOTE: Using callee_handled::<false> so JS callback receives (payload) not (err, payload)
  callback: Arc<
    ThreadsafeFunction<JsToolInvocation, ToolHandlerReturn, JsToolInvocation, napi::Status, false>,
  >,
}

struct JsApprovalInterceptor {
  callback:
    ThreadsafeFunction<JsApprovalRequest, ApprovalHandlerReturn, JsApprovalRequest, Status, true>,
}

#[allow(dead_code)]
struct JsToolInterceptor {
  callback: ThreadsafeFunction<
    JsToolInterceptorContext,
    ToolHandlerReturn,
    JsToolInterceptorContext,
    napi::Status,
    true,
  >,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct WorkspaceWriteOptions {
  #[napi(js_name = "networkAccess")]
  pub network_access: Option<bool>,
  #[napi(js_name = "writableRoots")]
  pub writable_roots: Option<Vec<String>>,
  #[napi(js_name = "excludeTmpdirEnvVar")]
  pub exclude_tmpdir_env_var: Option<bool>,
  #[napi(js_name = "excludeSlashTmp")]
  pub exclude_slash_tmp: Option<bool>,
}

#[napi]
pub fn clear_registered_tools() -> napi::Result<()> {
  registered_native_tools()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("tools mutex poisoned: {e}")))?
    .clear();
  registered_tool_infos()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("tools infos mutex poisoned: {e}")))?
    .clear();
  registered_native_interceptors()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("interceptors mutex poisoned: {e}")))?
    .clear();
  pending_builtin_calls()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("pending builtin mutex poisoned: {e}")))?
    .clear();
  test_tool_callbacks()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("test tool callbacks mutex poisoned: {e}")))?
    .clear();
  Ok(())
}

#[napi]
pub fn list_registered_tools() -> napi::Result<Vec<NativeToolInfo>> {
  let guard = registered_tool_infos()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("tools infos mutex poisoned: {e}")))?;

  Ok(guard.clone())
}

#[napi]
pub fn register_approval_callback(
  env: Env,
  #[napi(ts_arg_type = "(request: JsApprovalRequest) => boolean | Promise<boolean>")]
  handler: Function<JsApprovalRequest, ApprovalHandlerReturn>,
) -> napi::Result<()> {
  let sensitive_tools = ["local_shell", "exec_command", "apply_patch", "web_search"];

  for tool_name in sensitive_tools {
    let mut tsfn = handler
      .build_threadsafe_function::<JsApprovalRequest>()
      .callee_handled::<true>()
      .build()?;
    #[allow(deprecated)]
    let _ = tsfn.unref(&env);

    let interceptor = NativeToolInterceptor {
      tool_name: tool_name.to_string(),
      handler: Arc::new(JsApprovalInterceptor { callback: tsfn }),
    };

    registered_native_interceptors()
      .lock()
      .map_err(|e| napi::Error::from_reason(format!("interceptors mutex poisoned: {e}")))?
      .push(interceptor);
  }

  Ok(())
}

#[napi]
pub fn register_tool(
  env: Env,
  info: NativeToolInfo,
  #[napi(
    ts_arg_type = "(call: JsToolInvocation) => NativeToolResponse | Promise<NativeToolResponse>"
  )]
  handler: Function<JsToolInvocation, ToolHandlerReturn>,
) -> napi::Result<()> {
  let schema = info.parameters.clone().unwrap_or_else(|| {
    json!({
        "type": "object",
        "properties": {}
    })
  });
  let spec = create_function_tool_spec_from_schema(
    info.name.clone(),
    info.description.clone(),
    schema,
    info.strict.unwrap_or(false),
  )
  .map_err(|err| napi::Error::from_reason(format!("invalid tool schema: {err}")))?;

  // Use callee_handled::<false>() so JS callback receives single arg (payload) not (err, payload)
  let mut tsfn = handler
    .build_threadsafe_function::<JsToolInvocation>()
    .callee_handled::<false>()
    .build()?;
  #[allow(deprecated)]
  let _ = tsfn.unref(&env);
  let tsfn = Arc::new(tsfn);

  // Keep a copy for test-only direct invocation to validate payload delivery.
  test_tool_callbacks()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("test tool callbacks mutex poisoned: {e}")))?
    .insert(info.name.clone(), tsfn.clone());

  let registration = ExternalToolRegistration {
    spec,
    handler: Arc::new(JsToolHandler { callback: tsfn.clone() }),
    supports_parallel_tool_calls: info.supports_parallel.unwrap_or(true),
  };

  registered_native_tools()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("tools mutex poisoned: {e}")))?
    .push(registration);

  // Maintain a JS-friendly mirror of tool metadata for inspection/testing.
  {
    let mut infos = registered_tool_infos()
      .lock()
      .map_err(|e| napi::Error::from_reason(format!("tools infos mutex poisoned: {e}")))?;
    // Replace any existing entry for the same tool name to avoid duplicates.
    infos.retain(|t| t.name != info.name);
    infos.push(info);
  }

  Ok(())
}

/// Test helper: invoke a registered tool's JS callback directly to validate payload wiring.
/// Not intended for production use.
#[napi(ts_args_type = "toolName: string, invocation: JsToolInvocation")]
pub async fn call_registered_tool_for_test(
  tool_name: String,
  invocation: JsToolInvocation,
) -> napi::Result<NativeToolResponse> {
  let callback = {
    let guard = test_tool_callbacks()
      .lock()
      .map_err(|e| napi::Error::from_reason(format!("test tool callbacks mutex poisoned: {e}")))?;
    guard
      .get(&tool_name)
      .cloned()
      .ok_or_else(|| napi::Error::from_reason(format!("No registered tool named `{tool_name}`")))?
  };

  match callback
    .call_async(invocation)
    .await
    .map_err(|e| napi::Error::from_reason(e.to_string()))?
  {
    napi::Either::A(promise) => promise
      .await
      .map_err(|e| napi::Error::from_reason(e.to_string())),
    napi::Either::B(native_response) => Ok(native_response),
  }
}

#[napi]
pub fn register_tool_interceptor(
  env: Env,
  tool_name: String,
  #[napi(
    ts_arg_type = "(context: JsToolInterceptorContext) => NativeToolResponse | Promise<NativeToolResponse>"
  )]
  handler: Function<JsToolInterceptorContext, ToolHandlerReturn>,
) -> napi::Result<()> {
  let mut tsfn = handler
    .build_threadsafe_function::<JsToolInterceptorContext>()
    .callee_handled::<true>()
    .build()?;
  #[allow(deprecated)]
  let _ = tsfn.unref(&env);

  let interceptor = NativeToolInterceptor {
    tool_name: tool_name.clone(),
    handler: Arc::new(JsToolInterceptor { callback: tsfn }),
  };

  registered_native_interceptors()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("interceptors mutex poisoned: {e}")))?
    .push(interceptor);

  Ok(())
}

#[napi(ts_args_type = "token: string, invocation?: JsToolInvocation")]
pub async fn call_tool_builtin(
  token: String,
  invocation_override: Option<JsToolInvocation>,
) -> napi::Result<NativeToolResponse> {
  let mut entry = pending_builtin_calls()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("pending builtin mutex poisoned: {e}")))?
    .remove(&token)
    .ok_or_else(|| napi::Error::from_reason(format!("No pending builtin call for token {token}")))?;

  let next = entry
    .next
    .take()
    .ok_or_else(|| napi::Error::from_reason("callBuiltin already invoked for this token"))?;

  let mut invocation = entry.invocation.clone();
  if let Some(override_invocation) = invocation_override {
    if override_invocation.tool_name != invocation.tool_name {
      return Err(napi::Error::from_reason(
        "callBuiltin invocation tool mismatch with original tool",
      ));
    }
    if !override_invocation.call_id.is_empty() {
      invocation.call_id = override_invocation.call_id;
    }
    match (override_invocation.arguments, override_invocation.input) {
      (Some(arguments), _) => {
        invocation.payload = ToolPayload::Function { arguments };
      }
      (None, Some(input)) => {
        invocation.payload = ToolPayload::Custom { input };
      }
      (None, None) => {}
    }
  }

  match next.call(invocation).await {
    Ok(output) => tool_output_to_native_response(output).map_err(napi::Error::from_reason),
    Err(FunctionCallError::RespondToModel(message)) => {
      Ok(NativeToolResponse {
        output: None,
        success: Some(false),
        error: Some(message),
      })
    }
    Err(FunctionCallError::MissingLocalShellCallId) => Err(napi::Error::from_reason(
      "callBuiltin failed: missing local shell call id",
    )),
    Err(FunctionCallError::Fatal(message)) => Err(napi::Error::from_reason(message)),
  }
}

#[napi]
pub fn emit_background_event(req: JsEmitBackgroundEventRequest) -> napi::Result<()> {
  let handler = {
    let map = active_thread_handlers()
      .lock()
      .map_err(|e| napi::Error::from_reason(format!("thread handlers mutex poisoned: {e}")))?;
    map.get(&req.thread_id).cloned()
  };

  let handler = handler.ok_or_else(|| {
    napi::Error::from_reason(format!(
      "No active run for thread {}. Mid-turn notifications require an ongoing runStreamed call.",
      req.thread_id
    ))
  })?;

  dispatch_thread_event(
    &handler,
    ExecThreadEvent::BackgroundEvent(BackgroundEventEvent {
      message: req.message,
    }),
  )
}

#[napi]
pub fn emit_plan_update(req: JsEmitPlanUpdateRequest) -> napi::Result<()> {
  let plan_items = req
    .plan
    .into_iter()
    .map(|item| {
      let status_str = item.status.as_deref().unwrap_or("pending");
      let status = match status_str {
        "pending" => codex_protocol::plan_tool::StepStatus::Pending,
        "in_progress" => codex_protocol::plan_tool::StepStatus::InProgress,
        "completed" => codex_protocol::plan_tool::StepStatus::Completed,
        _ => {
          return Err(napi::Error::from_reason(format!(
            "Invalid status: {}",
            status_str
          )));
        }
      };
      Ok(codex_protocol::plan_tool::PlanItemArg {
        step: item.step,
        status,
      })
    })
    .collect::<Result<Vec<_>, _>>()?;

  let args = codex_protocol::plan_tool::UpdatePlanArgs {
    explanation: req.explanation,
    plan: plan_items,
  };

  pending_plan_updates()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("plan updates mutex poisoned: {e}")))?
    .insert(req.thread_id, args);

  Ok(())
}

#[napi]
pub fn modify_plan(req: JsModifyPlanRequest) -> napi::Result<()> {
  let mut pending_updates = pending_plan_updates()
    .lock()
    .map_err(|e| napi::Error::from_reason(format!("plan updates mutex poisoned: {e}")))?;

  let current_plan = pending_updates.get(&req.thread_id).cloned();

  let mut plan_items = if let Some(existing) = current_plan {
    existing.plan
  } else {
    Vec::new()
  };

  for op in req.operations {
    match op.type_.as_str() {
      "add" => {
        if let Some(item) = op.item {
          let status_str = item.status.as_deref().unwrap_or("pending");
          let status = match status_str {
            "pending" => codex_protocol::plan_tool::StepStatus::Pending,
            "in_progress" => codex_protocol::plan_tool::StepStatus::InProgress,
            "completed" => codex_protocol::plan_tool::StepStatus::Completed,
            _ => codex_protocol::plan_tool::StepStatus::Pending,
          };
          plan_items.push(codex_protocol::plan_tool::PlanItemArg {
            step: item.step,
            status,
          });
        }
      }
      "update" => {
        if let (Some(index), Some(updates)) = (op.index, op.updates) {
          let idx = index as usize;
          if idx < plan_items.len() {
            let item = &mut plan_items[idx];
            if let Some(new_step) = updates.step.filter(|step| !step.is_empty()) {
              item.step = new_step;
            }
            if let Some(status_str) = updates.status.as_deref() {
              let status = match status_str {
                "pending" => codex_protocol::plan_tool::StepStatus::Pending,
                "in_progress" => codex_protocol::plan_tool::StepStatus::InProgress,
                "completed" => codex_protocol::plan_tool::StepStatus::Completed,
                _ => item.status.clone(),
              };
              item.status = status;
            }
          }
        }
      }
      "remove" => {
        if let Some(index) = op.index {
          let idx = index as usize;
          if idx < plan_items.len() {
            plan_items.remove(idx);
          }
        }
      }
      "reorder" => {
        if let Some(new_order) = op.new_order {
          let mut reordered = Vec::new();
          for &idx in &new_order {
            let idx = idx as usize;
            if idx < plan_items.len() {
              reordered.push(plan_items[idx].clone());
            }
          }
          if reordered.len() == plan_items.len() {
            plan_items = reordered;
          }
        }
      }
      _ => {}
    }
  }

  let args = codex_protocol::plan_tool::UpdatePlanArgs {
    explanation: None, // Could be extended to support per-operation explanations
    plan: plan_items,
  };

  pending_updates.insert(req.thread_id, args);

  Ok(())
}
