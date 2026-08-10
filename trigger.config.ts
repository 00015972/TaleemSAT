import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_kwsnilmvhxnripdzdkvy",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    // Native and self-referencing packages must not be bundled. @napi-rs/canvas
    // resolves a platform-specific .node binding at require time, which esbuild
    // rewrites out from under it ("Cannot find native binding"); pdfjs-dist
    // ships an ESM build that expects its own worker paths to stay intact.
    external: ["@napi-rs/canvas", "pdfjs-dist"],
  },
});
