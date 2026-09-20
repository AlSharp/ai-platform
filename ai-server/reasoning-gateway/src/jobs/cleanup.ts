import type { FastifyBaseLogger } from "fastify";
import type { JobRepository } from "./types";

export class JobCleanup {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: JobRepository,
    private readonly logger: FastifyBaseLogger,
    private readonly retentionHours =
      Number(process.env.JOB_RETENTION_HOURS ?? 24),
    private readonly intervalMs = 60 * 60 * 1000,
  ) {}

  start(): void {
    if (this.timer) return;

    this.run();

    this.timer = setInterval(
      () => this.run(),
      this.intervalMs,
    );
  }

  stop(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = undefined;
  }

  private run(): void {
    const cutoff = new Date(
      Date.now() -
        this.retentionHours * 60 * 60 * 1000,
    ).toISOString();

    const deleted =
      this.repository.purgeTerminalJobs(cutoff);

    if (deleted > 0) {
      this.logger.info(
        {
          event: "jobs.purged",
          deleted,
          retentionHours: this.retentionHours,
        },
        "Expired reasoning jobs purged",
      );
    }
  }
}