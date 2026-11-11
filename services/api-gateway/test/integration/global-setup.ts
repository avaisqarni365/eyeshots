import { Client } from 'pg';
import type { Server } from 'http';
import { startMockStirling } from './mock-stirling';
import { MOCK_STIRLING_PORT, TEST_DATABASE_URL } from './env';

/** Starts the mock engine and makes sure the test database exists. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `Integration tests need Postgres at ${new URL(TEST_DATABASE_URL).host} (set TEST_DATABASE_URL). ` +
        `Start it with: docker compose up -d postgres redis — ${(err as Error).message}`,
    );
  }
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
  await admin.end();

  const server: Server = await startMockStirling(MOCK_STIRLING_PORT);
  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
