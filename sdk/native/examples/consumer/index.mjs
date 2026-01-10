import { Codex } from "@codex-native/sdk";

console.log("Codex export:", typeof Codex);
const instance = new Codex();
console.log("Codex instance created:", Boolean(instance));
