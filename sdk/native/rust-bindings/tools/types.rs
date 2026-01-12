fn native_response_to_tool_output(
  response: NativeToolResponse,
) -> Result<ToolOutput, FunctionCallError> {
  if let Some(error) = response.error {
    return Err(FunctionCallError::RespondToModel(error));
  }
  let output = response.output.unwrap_or_default();
  Ok(ToolOutput::Function {
    content: output,
    content_items: None,
    success: response.success,
  })
}

fn tool_output_to_native_response(output: ToolOutput) -> Result<NativeToolResponse, String> {
  match output {
    ToolOutput::Function {
      content,
      content_items: _,
      success,
    } => Ok(NativeToolResponse {
      output: Some(content),
      success,
      error: None,
    }),
    _ => Err("callBuiltin received unsupported output type".to_string()),
  }
}

