# Modular TUI Components

## Overview

The Codex SDK now provides modular, reusable TUI (Terminal User Interface) components that can be controlled from JavaScript. These components enable you to create custom terminal interfaces for various use cases beyond the standard Codex chat interface.

## Key Features

- **Modular Components**: Use only the components you need
- **Multi-Agent Support**: Display and manage multiple agent threads simultaneously
- **Flexible Layouts**: Create custom layouts with splits, tabs, and grids
- **Real-time Updates**: Components support dynamic updates and event handling
- **TypeScript Support**: Full TypeScript definitions for type safety

## Available Components

### TuiApp
The main application container for your TUI.

```typescript
const app = new TuiApp(title?: string, width?: number, height?: number);
await app.startTerminal();
await app.stopTerminal();
```

### AgentView
Display and interact with individual agent threads.

```typescript
const agent = new AgentView(threadId: string, title?: string);
await agent.sendMessage(message: string);
await agent.receiveMessage(message: string);
await agent.updateStatus(status: string);
await agent.appendOutput(output: string);
```

### AgentOrchestrator
Manage multiple agents with different view modes.

```typescript
const orchestrator = new AgentOrchestrator();
await orchestrator.addAgent(id: string, config: AgentConfig);
await orchestrator.removeAgent(id: string);
await orchestrator.setViewMode(mode: "single" | "split" | "grid" | "tabs");
await orchestrator.switchToAgent(id: string);
```

### StatusBoard
Display status information in a grid of tiles.

```typescript
const statusBoard = new StatusBoard(layout?: string);
await statusBoard.addTextTile(id: string, title: string, value: string);
await statusBoard.addProgressTile(id: string, title: string, value: number);
await statusBoard.updateTile(id: string, value: string);
```

### LayoutManager
Create custom layouts for your components.

```typescript
const layout = new LayoutManager();
await layout.setSplit(
  orientation: "horizontal" | "vertical",
  ratio: number,
  leftId: string,
  rightId: string
);
```

## Usage Examples

### Multi-Agent Orchestration

```typescript
import { AgentOrchestrator } from "@codex-native/sdk";

const orchestrator = new AgentOrchestrator();

// Add multiple agents
await orchestrator.addAgent("agent1", {
  name: "Research Agent",
  model: "gpt-5.1-codex",
  task: "Research task"
});

await orchestrator.addAgent("agent2", {
  name: "Code Agent",
  model: "gpt-5.1-codex-mini",
  task: "Implementation"
});

// Display in grid view
await orchestrator.setViewMode("grid");
```

### Status Monitoring Dashboard

```typescript
import { TuiApp, StatusBoard } from "@codex-native/sdk";

const app = new TuiApp("Build Monitor", 100, 30);
const board = new StatusBoard("grid");

await board.addTextTile("status", "Build", "✅ Passing");
await board.addProgressTile("tests", "Tests", 0.95);
await board.addTextTile("coverage", "Coverage", "95%");

await app.startTerminal();
```

### Custom Agent Interface

```typescript
import { AgentView } from "@codex-native/sdk";

const agent = new AgentView("custom-thread", "My Agent");

await agent.sendMessage("Process this data");
await agent.updateStatus("Processing...");
await agent.appendOutput("Step 1 complete");
await agent.receiveMessage("Data processed successfully");
```

## Architecture

The TUI components are built on top of:
- **Rust/Ratatui**: High-performance terminal rendering
- **NAPI-RS**: Native bindings for Node.js
- **Tokio**: Async runtime for event handling
- **Crossterm**: Cross-platform terminal manipulation

## Implementation Status

### Completed
✅ Basic component structure and bindings
✅ TuiApp container
✅ AgentView for individual threads
✅ StatusBoard for metrics display
✅ AgentOrchestrator for multi-agent management
✅ LayoutManager for custom layouts

### In Progress
🚧 Event handling and keyboard shortcuts
🚧 Advanced layout options (nested splits, floating windows)
🚧 Theme customization
🚧 Component state persistence

### Planned
📋 Chart and graph widgets
📋 File tree widget
📋 Diff viewer widget
📋 Markdown renderer
📋 Terminal emulator widget

## Benefits Over Monolithic TUI

1. **Flexibility**: Create custom interfaces tailored to specific use cases
2. **Modularity**: Include only the components you need
3. **Composability**: Combine components in different ways
4. **Reusability**: Share TUI components across projects
5. **JavaScript Control**: Full control from JavaScript/TypeScript

## Migration from run_tui()

If you're currently using the monolithic `run_tui()` function:

```typescript
// Old way
await run_tui(session);

// New way
const app = new TuiApp("Codex Chat");
const agent = new AgentView(session.threadId, "Main");
await app.startTerminal();
// ... interact with agent ...
await app.stopTerminal();
```

## Performance Considerations

- Components use dirty region tracking for efficient rendering
- Thread-safe updates from multiple agents
- Component pooling for memory efficiency
- Lazy loading of widgets

## Platform Support

- ✅ macOS
- ✅ Linux
- ✅ Windows (with Windows Terminal)
- ⚠️ Limited support in legacy terminals

## Contributing

To add new TUI components:

1. Define the component in `rust-bindings/tui_components.rs`
2. Implement the `Component` trait
3. Add NAPI bindings with `#[napi]`
4. Export from TypeScript definitions
5. Add examples and documentation

## Future Enhancements

- **React-like component model**: Declarative component definitions
- **Hot reload**: Update components without restarting
- **Remote TUI**: Access TUI over network
- **Recording/Playback**: Record and replay TUI sessions
- **Accessibility**: Screen reader support

## See Also

- [TUI_MODULAR_DESIGN.md](../TUI_MODULAR_DESIGN.md) - Original design document
- [examples/multi-agent-tui.ts](../examples/multi-agent-tui.ts) - Complete example
- [rust-bindings/tui_components.rs](../rust-bindings/tui_components.rs) - Implementation