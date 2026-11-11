import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';

export const QUEUE_NAME = 'eyeshots-pdf-jobs';

/**
 * Tools that may be queued. Protect/unlock are deliberately excluded: queuing
 * them would persist the user's password in Redis job data for up to the TTL.
 * They are fast operations and stay on the synchronous /api/tools path.
 */
export const QUEUEABLE_TOOLS = new Set(['merge', 'compress', 'ocr', 'office-to-pdf', 'pdf-to-word', 'repair', 'pdf-a', 'bates-numbering']);

export interface JobInput {
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface JobData {
  tool: string;
  params: Record<string, unknown>;
  inputs: JobInput[];
  outputName: string;
  submittedAt: number;
  /** Set when submitted by a signed-in user; only they can read the job. */
  ownerId?: string;
}

export interface JobResult {
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

/** Stage + percentage reported by the worker via job.updateProgress(). */
export interface JobProgress {
  stage: 'starting' | 'loading' | 'processing' | 'saving' | 'done';
  percent: number;
}

export const jobTtlMs = () => config.JOB_TTL_MINUTES * 60_000;

export function createRedis(): IORedis {
  if (!config.REDIS_URL) throw new Error('REDIS_URL is not configured');
  // maxRetriesPerRequest: null is required by BullMQ for blocking connections.
  return new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

let queue: Queue<JobData, JobResult> | null = null;
let redis: IORedis | null = null;

export function getQueue(): Queue<JobData, JobResult> {
  if (!queue) {
    redis = createRedis();
    queue = new Queue<JobData, JobResult>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        // Job metadata is removed from Redis with the same TTL as the blobs.
        removeOnComplete: { age: Math.floor(jobTtlMs() / 1000) },
        removeOnFail: { age: Math.floor(jobTtlMs() / 1000) },
      },
    });
  }
  return queue;
}

export async function closeQueue(): Promise<void> {
  await queue?.close();
  redis?.disconnect();
}

/** Job-scoped blob keys. Random UUID-based, never derived from user file names. */
export const blobKeys = {
  input: (jobId: string, i: number) => `${jobId}/in-${i}`,
  output: (jobId: string) => `${jobId}/out`,
};
