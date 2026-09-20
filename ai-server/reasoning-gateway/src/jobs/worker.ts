import type { FastifyBaseLogger } from "fastify";

import type { ReasoningTier } from "../types/reasoning";
import { reason } from "../services/reasoning";
import type { JobRepository } from "./types";
import { isRetryableError } from "./retry";

export class ReasoningWorker {
  private active = 0;
  private stopping = false;
  private timer?: NodeJS.Timeout;
  private readonly controllers = new Map<string, AbortController>();
  private readonly executions = new Set<Promise<void>>();

  constructor(
    private readonly tier: ReasoningTier,
    private readonly maxConcurrent: number,
    private readonly repository: JobRepository,
    private readonly logger: FastifyBaseLogger,
    private readonly pollIntervalMs = 5000,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.stopping = false;

    this.logger.info(
      {
        event: "worker.started",
        tier: this.tier,
        maxConcurrent: this.maxConcurrent,
      },
      "Reasoning worker started",
    );

    this.timer = setInterval(() => {
      this.schedule();
    }, this.pollIntervalMs);

    this.schedule();
  }

  async stop(): Promise<void> {
    this.stopping = true;

    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = undefined;
    for (const controller of this.controllers.values()) {
      controller.abort();
    }

    await Promise.allSettled(this.executions);
  }

  cancel(jobId: string): boolean {
    const controller =
      this.controllers.get(jobId);

    if (!controller) {
      return false;
    }

    controller.abort();
    return true;
  }

  wake(): void {
    this.schedule();
  }

  isRunning(): boolean {
    return this.timer !== undefined;
  }

  private schedule(): void {
    while (this.active < this.maxConcurrent) {
      const job = this.repository.claimNext(this.tier);

      if (!job) {
        break;
      }

      this.active++;

      const execution = this.execute(job.id);

      this.executions.add(execution);

      void execution.finally(() => {
        this.executions.delete(execution);
      });
    }
  }

  private async execute(jobId: string): Promise<void> {
    const controller = new AbortController();
    
    this.controllers.set(
      jobId,
      controller,
    )

    const job = this.repository.get(jobId);

    if (!job) {
      this.active--;
      return;
    }

    const started = Date.now();

    try {
      const result = await reason(
        job.request,
        this.logger,
        controller.signal
      );

      const current = this.repository.get(jobId);

      if (current?.status === "cancel_requested") {
        this.repository.cancel(jobId);
        return;
      }

      this.repository.complete(jobId, result);

      this.logger.info(
        {
          event: "job.completed",
          jobId,
          tier: this.tier,
          durationMs: Date.now() - started,
        },
        "Reasoning job completed",
      );
    } catch (error) {
      const current = this.repository.get(jobId);

      if (current?.status === 'cancel_requested') {
        this.repository.cancel(jobId);

        this.logger.info(
          {
            event: "job.cancelled",
            jobId,
            tier: this.tier,
            durationMs: Date.now() - started,
          },
          "Reasoning job cancelled",
        );

        return;
      }

      if (this.stopping && current?.status === 'running') {
        this.repository.requeue(jobId, 0, true);

        this.logger.info(
          {
            event: "job.requeued_shutdown",
            jobId,
            tier: this.tier,
            attempt: current.attempt,
          },
          "Reasoning job requeued during gateway shutdown",
        );

        return
      }

      const maxAttempts = Number(process.env.JOB_MAX_ATTEMPTS ?? 3);

      if (current && isRetryableError(error) && current.attempt < maxAttempts) {
        const delayMs = 2000 * Math.pow(2, current.attempt - 1);
        this.repository.requeue(jobId, delayMs);

        this.logger.warn(
          {
            event: "job.requeued",
            jobId,
            tier: this.tier,
            attempt: current.attempt,
            maxAttempts,
            retryInMs: delayMs,
          },
          "Reasoning job requeued after transient failure",
        );

        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unknown reasoning error";

      this.repository.fail(jobId, message);

      this.logger.error(
        {
          event: "job.failed",
          jobId,
          tier: this.tier,
          durationMs: Date.now() - started,
          err: error,
        },
        "Reasoning job failed",
      );
    } finally {
      this.controllers.delete(jobId);
      this.active--;
      this.schedule();
    }
  }
}