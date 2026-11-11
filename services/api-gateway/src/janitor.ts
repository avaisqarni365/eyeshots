import fs from 'fs';
import path from 'path';

/**
 * Ephemeral Storage Janitor Service
 * Enforces the EyeShots Zero-Retention Privacy Guarantee:
 * Every temporary document artifact must have a maximum Time-To-Live (TTL) of 120 minutes (2 hours).
 */
export class EphemeralJanitor {
  private tempDirectories: string[];
  private maxTtlMs: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private lastPurgeTime: Date | null = null;
  private purgedCountTotal: number = 0;

  constructor(tempDirectories: string[] = [], maxTtlMinutes: number = 120) {
    this.tempDirectories = tempDirectories;
    this.maxTtlMs = maxTtlMinutes * 60 * 1000;
  }

  /**
   * Start the recurring janitor cleaner job (runs every 15 minutes)
   */
  public start(intervalMinutes: number = 15): void {
    console.log(`[Ephemeral Janitor] Initialized with TTL: ${this.maxTtlMs / 60000} minutes`);
    
    // Run initial scan
    this.purgeExpiredFiles();

    // Schedule periodic sweep
    this.intervalHandle = setInterval(() => {
      this.purgeExpiredFiles();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the janitor
   */
  public stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('[Ephemeral Janitor] Stopped.');
    }
  }

  /**
   * Purge all files exceeding the 2-hour TTL
   */
  public purgeExpiredFiles(): number {
    const now = Date.now();
    let purgedThisRun = 0;

    for (const dir of this.tempDirectories) {
      if (!fs.existsSync(dir)) continue;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stats = fs.statSync(filePath);
            const ageMs = now - stats.mtimeMs;

            if (ageMs > this.maxTtlMs) {
              if (stats.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
              purgedThisRun++;
              this.purgedCountTotal++;
            }
          } catch (err: any) {
            console.error(`[Ephemeral Janitor] Error inspecting ${filePath}:`, err.message);
          }
        }
      } catch (err: any) {
        console.error(`[Ephemeral Janitor] Error reading directory ${dir}:`, err.message);
      }
    }

    this.lastPurgeTime = new Date();
    if (purgedThisRun > 0) {
      console.log(`[Ephemeral Janitor] Purged ${purgedThisRun} expired documents (TTL > 2h). Total purged: ${this.purgedCountTotal}`);
    }

    return purgedThisRun;
  }

  /**
   * Get audit statistics
   */
  public getStatus() {
    return {
      status: 'active',
      ttlMinutes: this.maxTtlMs / 60000,
      totalPurgedFiles: this.purgedCountTotal,
      lastPurgeTime: this.lastPurgeTime ? this.lastPurgeTime.toISOString() : null,
      zeroRetentionPolicyEnforced: true,
    };
  }
}
