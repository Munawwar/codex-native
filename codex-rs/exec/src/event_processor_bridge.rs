use std::path::PathBuf;

use crate::event_processor::CodexStatus;
use crate::event_processor::EventProcessor;
use crate::event_processor::handle_last_message;
use crate::event_processor_with_jsonl_output::EventProcessorWithJsonOutput;
use crate::exec_events::ThreadEvent;
use codex_core::config::Config;
use codex_core::protocol::Event;
use codex_core::protocol::EventMsg;
use codex_core::protocol::SessionConfiguredEvent;
use codex_core::protocol::TaskCompleteEvent;

pub(crate) fn callback_event_processor(
    callback: Box<dyn FnMut(ThreadEvent) + Send>,
    last_message_path: Option<PathBuf>,
) -> Box<dyn EventProcessor> {
    Box::new(JsonCallbackEventProcessor::new(callback, last_message_path))
}

struct JsonCallbackEventProcessor {
    inner: EventProcessorWithJsonOutput,
    callback: Box<dyn FnMut(ThreadEvent) + Send>,
}

impl JsonCallbackEventProcessor {
    fn new(
        callback: Box<dyn FnMut(ThreadEvent) + Send>,
        last_message_path: Option<PathBuf>,
    ) -> Self {
        Self {
            inner: EventProcessorWithJsonOutput::new(last_message_path),
            callback,
        }
    }
}

impl EventProcessor for JsonCallbackEventProcessor {
    fn print_config_summary(
        &mut self,
        _config: &Config,
        _prompt: &str,
        ev: &SessionConfiguredEvent,
    ) {
        let events = self.inner.collect_thread_events(&Event {
            id: String::new(),
            msg: EventMsg::SessionConfigured(ev.clone()),
        });
        for event in events {
            (self.callback)(event);
        }
    }

    fn process_event(&mut self, event: Event) -> CodexStatus {
        let aggregated = self.inner.collect_thread_events(&event);
        for conv_event in aggregated {
            (self.callback)(conv_event);
        }

        let Event { msg, .. } = event;
        if let EventMsg::TaskComplete(TaskCompleteEvent { last_agent_message }) = msg {
            if let Some(path) = self.inner.last_message_path().cloned() {
                handle_last_message(last_agent_message.as_deref(), path.as_path());
            }
            CodexStatus::InitiateShutdown
        } else {
            CodexStatus::Running
        }
    }
}
