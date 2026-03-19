import { createDefaultRegistry } from "./registry/default-registry";

const toolName = "write";
const registry = await createDefaultRegistry();
const spec = registry.getTool(toolName);
if (!spec) throw new Error(`Tool not registered: ${toolName}`);
console.log(spec);
// const text = await toolHandler(
//   {
//     path: "./test.txt",
//   },
//   { cwd: process.cwd() },
// );

// console.log(text);
