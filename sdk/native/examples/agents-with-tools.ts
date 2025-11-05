/**
 * Example: Using CodexProvider with OpenAI Agents framework and custom tools
 *
 * This example demonstrates how to:
 * - Use zod for type-safe tool parameters
 * - Register custom tools with the agents framework
 * - Use CodexProvider as the model backend
 * - Create a weather assistant agent
 *
 * Installation:
 * ```bash
 * npm install @codex-native/sdk @openai/agents zod
 * ```
 *
 * Usage:
 * ```bash
 * export CODEX_API_KEY="your-api-key"
 * export OPENAI_API_KEY="your-openai-api-key"
 * npx tsx examples/agents-with-tools.ts
 * ```
 */

import { z } from 'zod';
import {
  Agent,
  run,
  withTrace,
  OpenAIChatCompletionsModel,
  tool,
} from '@openai/agents';
import { OpenAI } from 'openai';
import { CodexProvider } from '../src/index.js';

// Define a weather tool using zod for type-safe parameters
const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get the weather for a given city',
  parameters: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  execute: async (input) => {
    console.log(`[debug] Getting weather for ${input.city}\n`);
    // Simulate weather API call
    const weatherConditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
    const condition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
    const temp = Math.floor(Math.random() * 30) + 10;
    return `The weather in ${input.city} is ${condition} with a temperature of ${temp}°C`;
  },
});

// Define a temperature conversion tool
const convertTemperatureTool = tool({
  name: 'convert_temperature',
  description: 'Convert temperature between Celsius and Fahrenheit',
  parameters: z.object({
    value: z.number().describe('The temperature value to convert'),
    from: z.enum(['celsius', 'fahrenheit']).describe('The unit to convert from'),
    to: z.enum(['celsius', 'fahrenheit']).describe('The unit to convert to'),
  }),
  execute: async (input) => {
    console.log(`[debug] Converting ${input.value}°${input.from[0].toUpperCase()} to ${input.to}\n`);

    if (input.from === input.to) {
      return `${input.value}°${input.from === 'celsius' ? 'C' : 'F'}`;
    }

    let result: number;
    if (input.from === 'celsius' && input.to === 'fahrenheit') {
      result = (input.value * 9/5) + 32;
    } else {
      result = (input.value - 32) * 5/9;
    }

    return `${input.value}°${input.from === 'celsius' ? 'C' : 'F'} is ${result.toFixed(1)}°${input.to === 'celsius' ? 'C' : 'F'}`;
  },
});

async function main() {
  console.log('🤖 OpenAI Agents with Codex Provider\n');

  // Create OpenAI client for GPT-5
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create an agent with GPT-5 and custom tools
  const weatherAgent = new Agent({
    name: 'WeatherAssistant',
    model: new OpenAIChatCompletionsModel(client, 'gpt-5'),
    instructions: 'You are a helpful weather assistant. You respond in haikus when providing weather information.',
    tools: [getWeatherTool, convertTemperatureTool],
  });

  console.log('✓ Created WeatherAssistant agent with GPT-5\n');

  // Run the agent with tracing
  await withTrace('Weather Assistant Example', async () => {
    console.log('Running query: "What\'s the weather in Tokyo?"\n');
    console.log('─'.repeat(60));

    const result = await run(weatherAgent, "What's the weather in Tokyo?");

    console.log('\n[Final response]');
    console.log(result.finalOutput);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✓ Example complete!');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, getWeatherTool, convertTemperatureTool };
