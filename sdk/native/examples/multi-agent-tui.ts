/**
 * Multi-Agent TUI Display Example
 *
 * This example demonstrates how to use the modular TUI components
 * to display multiple agent threads in a custom terminal interface.
 */

import {
  TuiApp,
  AgentView,
  AgentOrchestrator,
  StatusBoard,
  LayoutManager,
  WidgetType
} from "@codex-native/sdk";
import { Codex } from "@codex-native/sdk";

async function main() {
  // Create a TUI application with custom title and dimensions
  const app = new TuiApp("Multi-Agent Orchestrator", 120, 40);

  // Create an agent orchestrator to manage multiple agents
  const orchestrator = new AgentOrchestrator();

  // Add multiple agent threads with different configurations
  await orchestrator.addAgent("research-agent", {
    name: "Research Agent",
    model: "gpt-5.1-codex",
    task: "Research API documentation and best practices"
  });

  await orchestrator.addAgent("implementation-agent", {
    name: "Implementation Agent",
    model: "gpt-5.1-codex-mini",
    task: "Implement features based on research"
  });

  await orchestrator.addAgent("test-agent", {
    name: "Test Agent",
    model: "gpt-5.1-codex-mini",
    task: "Write tests and verify implementation"
  });

  // Set the view mode to display agents
  await orchestrator.setViewMode("grid"); // Options: single, split, grid, tabs

  // Create a status board to display metrics
  const statusBoard = new StatusBoard("grid");

  // Add status tiles
  await statusBoard.addTextTile("status", "System Status", "Running");
  await statusBoard.addProgressTile("progress", "Overall Progress", 0.0);
  await statusBoard.addTextTile("threads", "Active Threads", "3");
  await statusBoard.addTextTile("tokens", "Tokens Used", "0");

  // Create a layout manager for custom layout
  const layoutManager = new LayoutManager();

  // Set up a split layout with agents on the left and status on the right
  await layoutManager.setSplit(
    "horizontal", // Split horizontally
    0.7,          // 70% for agents, 30% for status
    "agents",     // Left widget ID
    "status"      // Right widget ID
  );

  // Start the terminal interface
  await app.startTerminal();

  // Example: Send messages to specific agents
  const researchAgent = new AgentView("research-agent", "Research Agent");
  await researchAgent.sendMessage("Please research the latest TUI best practices");
  await researchAgent.updateStatus("Researching...");

  // Example: Update status board dynamically
  let progress = 0;
  const progressInterval = setInterval(async () => {
    progress += 0.1;
    if (progress > 1.0) progress = 1.0;

    await statusBoard.updateTile("progress", `${(progress * 100).toFixed(0)}%`);

    if (progress >= 1.0) {
      clearInterval(progressInterval);
      await statusBoard.updateTile("status", "Complete");
    }
  }, 1000);

  // Example: Switch between agent views
  setTimeout(async () => {
    await orchestrator.switchToAgent("implementation-agent");
  }, 5000);

  // Example: Change view mode dynamically
  setTimeout(async () => {
    await orchestrator.setViewMode("tabs");
  }, 10000);

  // Keep the app running
  process.on('SIGINT', async () => {
    console.log("\\nShutting down...");
    await app.stopTerminal();
    process.exit(0);
  });
}

// Alternative: Use individual agent views
async function individualAgentExample() {
  // Create standalone agent views
  const agent1 = new AgentView("thread-1", "Code Generator");
  const agent2 = new AgentView("thread-2", "Code Reviewer");
  const agent3 = new AgentView("thread-3", "Test Runner");

  // Send messages to agents
  await agent1.sendMessage("Generate a REST API endpoint");
  await agent2.sendMessage("Review the generated code");
  await agent3.sendMessage("Run integration tests");

  // Update statuses
  await agent1.updateStatus("Generating code...");
  await agent2.updateStatus("Waiting for code...");
  await agent3.updateStatus("Preparing test environment...");

  // Append output
  await agent1.appendOutput("POST /api/users created");
  await agent1.appendOutput("GET /api/users/:id created");

  // Simulate receiving responses
  await agent1.receiveMessage("Code generation complete. Created 2 endpoints.");
  await agent2.receiveMessage("Starting code review...");
}

// Alternative: Create a custom monitoring dashboard
async function monitoringDashboard() {
  const app = new TuiApp("CI/CD Monitor", 100, 30);
  const statusBoard = new StatusBoard("grid");

  // Add monitoring tiles
  await statusBoard.addTextTile("build", "Build Status", "🟢 Passing");
  await statusBoard.addProgressTile("coverage", "Code Coverage", 0.85);
  await statusBoard.addTextTile("tests", "Tests", "247/250 passed");
  await statusBoard.addTextTile("deploy", "Deployment", "Ready");

  await app.startTerminal();

  // Simulate real-time updates
  setInterval(async () => {
    const randomCoverage = 0.8 + Math.random() * 0.15;
    await statusBoard.updateTile("coverage", `${(randomCoverage * 100).toFixed(1)}%`);
  }, 2000);
}

// Run the main example
if (require.main === module) {
  main().catch(console.error);
}

export { main, individualAgentExample, monitoringDashboard };