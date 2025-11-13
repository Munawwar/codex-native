import path from "node:path";

import { embedAnythingInit, embedAnythingEmbed } from "@codex-native/sdk";

async function main() {
  await embedAnythingInit({
    backend: "onnx",
    modelArchitecture: "bert",
    modelId: "sentence-transformers/all-MiniLM-L6-v2",
  });

  const snippets = [
    "CLI crashes after switching to the new sandbox",
    "Improve telemetry batching in the Codex provider",
    "Add thread forking to the CI inspector",
  ];

  const embeddings = await embedAnythingEmbed({
    inputs: snippets,
    projectRoot: process.cwd(),
    normalize: true,
  });

  embeddings.forEach((vector, idx) => {
    const preview = vector.slice(0, 5).map((value) => value.toFixed(4));
    console.log(`#${idx + 1} ${snippets[idx]} => [${preview.join(", ")}]`);
  });

  const cacheRoot = process.env.CODEX_HOME
    ? path.join(process.env.CODEX_HOME, "embeddings")
    : path.join(process.env.HOME ?? process.cwd(), ".codex", "embeddings");
  console.log(`\nVectors are cached under ${cacheRoot}`);
}

main().catch((error) => {
  console.error("Failed to run embed-anything example", error);
  process.exit(1);
});
