import type {
  ReasoningRequest,
  ReasoningResponse,
  ReasoningTier
} from "../types/reasoning";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export type ReasoningJob = {
  id: string;
  status: JobStatus;
  request: ReasoningRequest;
  result?: ReasoningResponse;
  error?: string;
  attempt: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  nextAttemptAt?: string
};

export type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  tier: ReasoningTier;
  attempt: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ReasoningResponse;
  error?: string;
};

export interface JobRepository {
  create(request: ReasoningRequest): ReasoningJob;
  get(id: string): ReasoningJob | null;
  claimNext(tier: ReasoningTier): ReasoningJob | null;
  complete(id: string, result: ReasoningResponse): void;
  fail(id: string, error: string): void;
  requestCancel(id: string): boolean;
  cancel(id: string): void;
  recoverRunningJobs(): void;
  requeue(id: string, delayMs: number, restoreAttempt?: boolean): void;
  purgeTerminalJobs(olderThan: string): number;
  isHealthy(): boolean;
  close(): void;
}