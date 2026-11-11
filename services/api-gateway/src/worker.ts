import { config } from './config';
import { createWorker } from './worker-core';

/** Worker entrypoint (`node dist/worker.js`). See worker-core.ts for the job processor. */
const { worker, connection } = createWorker();

async function shutdown(signal: string) {
  console.log(`[EyeShots Worker] ${signal} received — finishing active jobs…`);
  setTimeout(() => process.exit(1), config.STIRLING_TIMEOUT_MS + 10_000).unref();
  await worker.close(); // waits for in-flight jobs
  connection.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
