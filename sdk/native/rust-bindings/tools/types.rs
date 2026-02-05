fn native_response_to_tool_output(
  response: NativeToolResponse,
) -> Result<ToolOutput, FunctionCallError> {
  if let Some(error) = response.error {
    return Err(FunctionCallError::RespondToModel(error));
  }
  let output = response.output.unwrap_or_default();
  Ok(ToolOutput::Function {
    body: codex_protocol::models::FunctionCallOutputBody::Text(output),
    success: response.success,
  })
}

fn tool_output_to_native_response(output: ToolOutput) -> Result<NativeToolResponse, String> {
  match output {
    ToolOutput::Function { body, success } => Ok(NativeToolResponse {
      output: body.to_text(),
      success,
      error: None,
    }),
    _ => Err("callBuiltin received unsupported output type".to_string()),
  }
}
