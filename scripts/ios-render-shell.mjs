// Renders the start page from the normal build into .output/public/index.html so the
// iPhone wrapper (Capacitor) can load STUFIN fully offline from bundled files.
// Run after `vite build` with: bun scripts/ios-render-shell.mjs
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const serverEntry = pathToFileURL(resolve(".output/server/index.mjs")).href;
const mod = await import(serverEntry);
const handler = mod.default ?? mod;

const res = await handler.fetch(
  new Request("http://localhost/"),
  {},
  { waitUntil() {}, passThroughOnException() {} },
);
if (res.status !== 200) throw new Error(`Start page render failed with status ${res.status}`);
const html = await res.text();
if (!html.includes("<html")) throw new Error("Start page render returned no HTML");

await writeFile(resolve("dist/client/index.html"), html);
console.log(`Wrote dist/client/index.html (${html.length} bytes)`);
process.exit(0);
