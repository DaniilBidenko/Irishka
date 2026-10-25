import {
  closeAppContext,
  createAppContext,
} from "./bootstrap/appContext.js";
import {
  startAutoBackupScheduler,
  stopAutoBackupScheduler,
} from "./bootstrap/autoBackup.js";
import { startServer } from "./http/server.js";

async function main() {
  createAppContext();
  startAutoBackupScheduler();
  await startServer();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  stopAutoBackupScheduler();
  closeAppContext();
  process.exit(1);
});

function shutdown() {
  stopAutoBackupScheduler();
  closeAppContext();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
