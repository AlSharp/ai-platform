import type {
  JobStatusResponse,
  ReasoningJob,
} from "./types";

export function toJobStatusResponse(
  job: ReasoningJob,
): JobStatusResponse {
  return {
    jobId: job.id,
    status: job.status,
    tier: job.request.tier ?? "local",
    attempt: job.attempt,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    result: job.result,
    error: job.error,
  };
}