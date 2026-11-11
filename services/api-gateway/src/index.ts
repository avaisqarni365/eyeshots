import { config } from './config';
import { createApp } from './app';
import { closeQueue } from './queue';
import { purgeAuthData } from './auth';
import { closeDb, dbEnabled, migrate } from './db';

/** Runtime entrypoint: migrations, housekeeping timers, HTTP server, graceful shutdown. */

const { app, janitor } = createApp();
janitor.start(15);

async function start() {
  if (dbEnabled()) {
    await migrate();
    const purge = () => purgeAuthData().catch((err) => console.error(JSON.stringify({ level: 'error', msg: 'auth purge failed', error: err?.message })));
    void purge();
    setInterval(purge, 60 * 60_000).unref();
  } else {
    console.warn('[EyeShots Gateway] DATABASE_URL not set — accounts, billing and quotas are disabled (development mode).');
  }
  const server = app.listen(config.PORT, () => {
    console.log(`[EyeShots Gateway] listening on :${config.PORT} -> engine ${config.STIRLING_ENGINE_URL} (${config.NODE_ENV})`);
  });
  server.requestTimeout = config.STIRLING_TIMEOUT_MS + 30_000;
  return server;
}

const serverPromise = start().catch((err) => {
  console.error('[EyeShots Gateway] startup failed:', err?.message);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`[EyeShots Gateway] ${signal} received, draining…`);
  janitor.stop();
  void serverPromise.then((server) => server.close(() => void Promise.allSettled([closeQueue(), closeDb()]).finally(() => process.exit(0))));
  setTimeout(() => process.exit(1), 15_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
