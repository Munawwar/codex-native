# Modular TUI Components Design

## Overview
Expose the Rust TUI components as modular, reusable building blocks that can be controlled from JavaScript for various use cases beyond the Codex chat interface.

## Current State
- TUI is exposed as a monolithic `run_tui()` function that runs the full Codex chat interface
- Components are tightly coupled with the chat application logic
- No support for multiple concurrent views or custom layouts

## Proposed Architecture

### 1. Core TUI Components Library
Create a new `@codex-rs/tui-components` package that exposes:

```typescript
interface TuiComponents {
  // Core Layout Components
  layout: {
    createSplitPane(orientation: 'horizontal' | 'vertical'): SplitPane;
    createTabs(): TabContainer;
    createScrollableArea(): ScrollArea;
    createStatusBar(): StatusBar;
  };

  // Widget Components
  widgets: {
    createChatWidget(): ChatWidget;
    createTerminal(): TerminalWidget;
    createProgressBar(): ProgressBar;
    createTable(): TableWidget;
    createTextArea(): TextArea;
    createMarkdownRenderer(): MarkdownWidget;
    createDiffViewer(): DiffWidget;
    createFileTree(): FileTreeWidget;
  };

  // Multi-Agent Support
  agents: {
    createAgentView(threadId: string): AgentView;
    createAgentOrchestrator(): AgentOrchestrator;
    createAgentStatusBoard(): StatusBoard;
  };
}
```

### 2. JavaScript API

```typescript
import { TuiApp, Layout } from '@codex-rs/tui-components';

// Create a custom TUI application
const app = new TuiApp({
  title: 'Multi-Agent Monitor',
  dimensions: { width: 120, height: 40 }
});

// Create custom layout
const layout = app.createLayout({
  type: 'split',
  orientation: 'horizontal',
  ratio: 0.7,
  left: {
    type: 'tabs',
    tabs: [
      { id: 'agent1', title: 'Agent 1', content: createAgentView('thread-1') },
      { id: 'agent2', title: 'Agent 2', content: createAgentView('thread-2') },
      { id: 'agent3', title: 'Agent 3', content: createAgentView('thread-3') }
    ]
  },
  right: {
    type: 'split',
    orientation: 'vertical',
    ratio: 0.6,
    top: createStatusBoard(),
    bottom: createTerminal()
  }
});

// Event handling
app.on('keypress', (key) => {
  if (key === 'tab') {
    layout.nextTab();
  }
});

// Start the TUI
await app.run();
```

### 3. Native Bindings Structure

```rust
// sdk/native/rust-bindings/tui_components.rs

#[napi]
pub struct TuiApp {
  terminal: Terminal,
  layout: Layout,
  event_loop: EventLoop,
}

#[napi]
impl TuiApp {
  #[napi(constructor)]
  pub fn new(config: TuiConfig) -> Result<Self> { ... }

  #[napi]
  pub fn create_layout(&mut self, spec: LayoutSpec) -> Result<Layout> { ... }

  #[napi]
  pub fn add_widget(&mut self, widget: Widget) -> Result<()> { ... }

  #[napi]
  pub async fn run(&mut self) -> Result<()> { ... }
}

#[napi]
pub struct AgentView {
  thread_id: String,
  chat_widget: ChatWidget,
  status_line: StatusLine,
  terminal_output: TerminalWidget,
}

#[napi]
impl AgentView {
  #[napi]
  pub fn new(thread_id: String) -> Result<Self> { ... }

  #[napi]
  pub fn send_message(&mut self, message: String) -> Result<()> { ... }

  #[napi]
  pub fn update_status(&mut self, status: String) -> Result<()> { ... }
}
```

### 4. Use Cases

#### Multiple Agent Threads Display
```typescript
const orchestrator = new AgentOrchestrator();

// Add multiple agent threads
orchestrator.addAgent('research', { model: 'gpt-4', task: 'Research APIs' });
orchestrator.addAgent('coder', { model: 'gpt-5', task: 'Implement features' });
orchestrator.addAgent('tester', { model: 'gpt-4', task: 'Write tests' });

// Display all agents in a grid
const grid = orchestrator.createGridView({
  columns: 2,
  showStatus: true,
  showOutput: true
});

await grid.run();
```

#### Script Monitoring Dashboard
```typescript
const dashboard = new TuiDashboard();

dashboard.addPanel('build', {
  type: 'terminal',
  command: 'npm run build',
  showProgress: true
});

dashboard.addPanel('tests', {
  type: 'terminal',
  command: 'npm test --watch',
  highlightErrors: true
});

dashboard.addPanel('metrics', {
  type: 'chart',
  data: metricsStream
});

await dashboard.run();
```

#### Status Board
```typescript
const statusBoard = new StatusBoard({
  refreshRate: 1000,
  layout: 'grid'
});

statusBoard.addTile('CI Status', getCIStatus);
statusBoard.addTile('Agent Queue', getQueueLength);
statusBoard.addTile('Memory Usage', getMemoryUsage);
statusBoard.addTile('Active Threads', getActiveThreads);

await statusBoard.run();
```

### 5. Implementation Steps

1. **Extract Core Components** (codex-rs/tui)
   - Separate widget implementations from app logic
   - Create trait-based interfaces for widgets
   - Make components independently instantiable

2. **Create Component Registry**
   - Widget factory pattern
   - Component lifecycle management
   - Event bus for inter-component communication

3. **Build NAPI Bindings**
   - Expose component constructors
   - Implement event callbacks
   - Handle async rendering loop

4. **JavaScript SDK**
   - TypeScript definitions
   - React-like component model
   - Declarative layout API

5. **Examples & Documentation**
   - Multi-agent orchestrator example
   - Script runner dashboard
   - Custom widget creation guide

## Benefits
- **Modularity**: Use only the components you need
- **Flexibility**: Create custom layouts and workflows
- **Reusability**: Share TUI components across projects
- **Multi-Agent Support**: Built-in support for concurrent agent displays
- **Extensibility**: Easy to add custom widgets

## Migration Path
1. Keep existing `run_tui()` for backward compatibility
2. Gradually expose individual components
3. Provide migration guide for existing users
4. Eventually deprecate monolithic API

## Technical Considerations
- **Performance**: Efficient rendering with dirty region tracking
- **Thread Safety**: Safe concurrent updates from multiple agents
- **Memory**: Component pooling and recycling
- **Cross-Platform**: Ensure compatibility across Windows, Mac, Linux
- **Accessibility**: Screen reader support where possible