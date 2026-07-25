import pino from "pino";

// Default Pino config (JSON to stdout) is already what Docker's log driver
// wants — see compose.yaml's per-service `logging` blocks for the
// max-size/max-file bound on the captured output.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
