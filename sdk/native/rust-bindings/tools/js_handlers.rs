#[async_trait]
impl ToolHandler for JsToolHandler {
  fn kind(&self) -> ToolKind {
    ToolKind::Function
  }

  async fn handle(&self, invocation: ToolInvocation) -> Result<ToolOutput, FunctionCallError> {
    let js_invocation = match invocation.payload {
      ToolPayload::Function { arguments } => JsToolInvocation {
        call_id: invocation.call_id.clone(),
        tool_name: invocation.tool_name.clone(),
        arguments: Some(arguments),
        input: None,
      },
      ToolPayload::Custom { input } => JsToolInvocation {
        call_id: invocation.call_id.clone(),
        tool_name: invocation.tool_name.clone(),
        arguments: None,
        input: Some(input),
      },
      _ => {
        return Err(FunctionCallError::Fatal(format!(
          "tool `{}` received unsupported payload",
          invocation.tool_name
        )));
      }
    };

    match self.callback.call_async(js_invocation).await {
      Ok(napi::Either::A(promise)) => {
        let native_response = promise
          .await
          .map_err(|err| FunctionCallError::Fatal(err.to_string()))?;
        native_response_to_tool_output(native_response)
      }
      Ok(napi::Either::B(native_response)) => native_response_to_tool_output(native_response),
      Err(err) => Err(FunctionCallError::Fatal(err.to_string())),
    }
  }
}

#[async_trait]
impl ToolInterceptor for JsApprovalInterceptor {
  async fn intercept(
    &self,
    invocation: ToolInvocation,
    next: Box<
      dyn FnOnce(
          ToolInvocation,
        ) -> std::pin::Pin<
          Box<dyn std::future::Future<Output = Result<ToolOutput, FunctionCallError>> + Send>,
        > + Send,
    >,
  ) -> Result<ToolOutput, FunctionCallError> {
    let req_type = match invocation.tool_name.as_str() {
      "apply_patch" => "file_write",
      "local_shell" | "exec_command" => "shell",
      _ => "network_access",
    }
    .to_string();

    let details = match &invocation.payload {
      ToolPayload::LocalShell { params } => json!({
        "command": params.command,
        "workdir": params.workdir,
        "timeoutMs": params.timeout_ms,
      }),
      _ => json!({
        "payload": invocation.payload.log_payload(),
      }),
    };

    let approved = match self
      .callback
      .call_async(Ok(JsApprovalRequest {
        type_: req_type,
        details: Some(details),
      }))
      .await
    {
      Ok(napi::Either::A(promise)) => promise
        .await
        .map_err(|err| FunctionCallError::Fatal(err.to_string()))?,
      Ok(napi::Either::B(value)) => value,
      Err(err) => return Err(FunctionCallError::Fatal(err.to_string())),
    };

    if !approved {
      return Err(FunctionCallError::Denied(format!(
        "Approval denied for tool `{}`",
        invocation.tool_name
      )));
    }

    let next_box = move |inv: ToolInvocation| next(inv);
    let caller: Box<dyn NextCaller> = Box::new(next_box);
    caller.call(invocation).await
  }
}

#[async_trait]
impl ToolInterceptor for JsToolInterceptor {
  async fn intercept(
    &self,
    invocation: ToolInvocation,
    next: Box<
      dyn FnOnce(
          ToolInvocation,
        ) -> std::pin::Pin<
          Box<dyn std::future::Future<Output = Result<ToolOutput, FunctionCallError>> + Send>,
        > + Send,
    >,
  ) -> Result<ToolOutput, FunctionCallError> {
    let js_invocation = match invocation.payload.clone() {
      ToolPayload::Function { arguments } => JsToolInvocation {
        call_id: invocation.call_id.clone(),
        tool_name: invocation.tool_name.clone(),
        arguments: Some(arguments),
        input: None,
      },
      ToolPayload::Custom { input } => JsToolInvocation {
        call_id: invocation.call_id.clone(),
        tool_name: invocation.tool_name.clone(),
        arguments: None,
        input: Some(input),
      },
      _ => {
        return Err(FunctionCallError::Fatal(format!(
          "interceptor for tool `{}` received unsupported payload",
          invocation.tool_name
        )));
      }
    };

    let native_response = match self
      .callback
      .call_async(Ok(JsToolInterceptorContext {
        invocation: js_invocation,
        token: String::new(),
      }))
      .await
    {
      Ok(napi::Either::A(promise)) => promise
        .await
        .map_err(|err| FunctionCallError::Fatal(err.to_string()))?,
      Ok(napi::Either::B(resp)) => resp,
      Err(err) => return Err(FunctionCallError::Fatal(err.to_string())),
    };

    // If JS returns an error string, short-circuit and respond to the model.
    if let Some(error) = native_response.error {
      return Err(FunctionCallError::RespondToModel(error));
    }

    // Allow JS to override the invocation payload before calling through.
    let mut invocation_override = invocation;
    if let Some(arguments) = native_response.output {
      invocation_override.payload = ToolPayload::Function { arguments };
    }

    let next_box = move |inv: ToolInvocation| next(inv);
    let caller: Box<dyn NextCaller> = Box::new(next_box);
    caller.call(invocation_override).await
  }
}
