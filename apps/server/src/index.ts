import {
  closeAppContext,
  createAppContext,
} from "./bootstrap/appContext.js";
import { startServer } from "./http/server.js";

async function main() {
  createAppContext();
  await startServer();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  closeAppContext();
  process.exit(1);
});

process.on("SIGINT", () => {
  closeAppContext();
  process.exit(0);
});
process.on("SIGTERM", () => {
  closeAppContext();
  process.exit(0);
});
