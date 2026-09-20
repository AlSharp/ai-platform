import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ReasoningRequest,
  ReasoningResponse,
  ReasoningTier,
} from "../types/reasoning";

import type {
  JobStatus,
  ReasoningJob,
  JobRepository
} from "./types";

type JobRow = {
  id: string;
  status: JobStatus;
  request_json: string;
  result_json: string | null;
  error: string | null;
  attempt: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  next_attempt_at: string | null;
};

function rowToJob(row: JobRow): ReasoningJob {
  return {
    id: row.id,
    status: row.status,
    request: JSON.parse(row.request_json) as ReasoningRequest,
    result: row.result_json
      ? (JSON.parse(row.result_json) as ReasoningResponse)
      : undefined,
    error: row.error ?? undefined,
    attempt: row.attempt,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    nextAttemptAt: row.next_attempt_at ?? undefined,
  };
}

export class SqliteJobRepository implements JobRepository {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const directory = path.dirname(dbPath);

    fs.mkdirSync(directory, {
      recursive: true,
    });

    this.db = new Database(dbPath);

    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reasoning_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        request_json TEXT NOT NULL,
        result_json TEXT,
        error TEXT,
        attempt INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        next_attempt_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_reasoning_jobs_status_created
      ON reasoning_jobs(status, created_at);
    `);

    const columns = this.db
      .prepare("PRAGMA table_info(reasoning_jobs)")
      .all() as Array<{ name: string }>;

    if (!columns.some((column) => column.name === "next_attempt_at")) {
      this.db.exec(`
        ALTER TABLE reasoning_jobs
        ADD COLUMN next_attempt_at TEXT
      `);
    }
  }

  isHealthy(): boolean {
    try {
      this.db.prepare("SELECT 1").get();
      return true;
    } catch {
      return false;
    }
  }

  close(): void {
    this.db.close();
  }

  create(request: ReasoningRequest): ReasoningJob {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const normalizedRequest: ReasoningRequest = {
      ...request,
      tier: request.tier ?? 'local'
    }
    
    this.db
      .prepare(`
        INSERT INTO reasoning_jobs (
          id,
          status,
          request_json,
          attempt,
          created_at
        )
        VALUES (?, 'queued', ?, 0, ?)
      `)
      .run(
        id,
        JSON.stringify(normalizedRequest),
        createdAt,
      );

    return {
      id,
      status: "queued",
      request,
      attempt: 0,
      createdAt,
    };
  }

  get(id: string): ReasoningJob | null {
    const row = this.db
      .prepare(`
        SELECT *
        FROM reasoning_jobs
        WHERE id = ?
      `)
      .get(id) as JobRow | undefined;

    return row ? rowToJob(row) : null;
  }

  claimNext(tier: ReasoningTier): ReasoningJob | null {
    const transaction = this.db.transaction(() => {
      const now = new Date().toISOString();
      const row = this.db
        .prepare(`
          SELECT *
          FROM reasoning_jobs
          WHERE status = 'queued'
            AND json_extract(request_json, '$.tier') = ?
            AND (
              next_attempt_at IS NULL
              OR next_attempt_at <= ?
            )
          ORDER BY created_at ASC
          LIMIT 1
        `)
        .get(tier, now) as JobRow | undefined;

      if (!row) {
        return null;
      }

      const startedAt = new Date().toISOString();

      const result = this.db
        .prepare(`
          UPDATE reasoning_jobs
          SET
            status = 'running',
            started_at = ?,
            next_attempt_at = NULL,
            attempt = attempt + 1
          WHERE id = ?
            AND status = 'queued'
        `)
        .run(
          startedAt,
          row.id,
        );

      if (result.changes !== 1) {
        return null;
      }

      return this.get(row.id);
    });

    return transaction();
  }

  complete(
    id: string,
    result: ReasoningResponse,
  ): void {
    const completedAt = new Date().toISOString();

    this.db
      .prepare(`
        UPDATE reasoning_jobs
        SET
          status = 'completed',
          result_json = ?,
          error = NULL,
          completed_at = ?
        WHERE id = ?
          AND status = 'running'
      `)
      .run(
        JSON.stringify(result),
        completedAt,
        id,
      );
  }

  fail(
    id: string,
    error: string,
  ): void {
    const completedAt = new Date().toISOString();

    this.db
      .prepare(`
        UPDATE reasoning_jobs
        SET
          status = 'failed',
          error = ?,
          completed_at = ?
        WHERE id = ?
          AND status IN (
            'running',
            'cancel_requested'
          )
      `)
      .run(
        error,
        completedAt,
        id,
      );
  }

  requestCancel(id: string): boolean {
    const job = this.get(id);

    if (!job) {
      return false;
    }

    if (job.status === "queued") {
      this.cancel(id);
      return true;
    }

    if (job.status === "running") {
      this.db
        .prepare(`
          UPDATE reasoning_jobs
          SET status = 'cancel_requested'
          WHERE id = ?
            AND status = 'running'
        `)
        .run(id);

      return true;
    }

    return false;
  }

  cancel(id: string): void {
    const completedAt = new Date().toISOString();

    this.db
      .prepare(`
        UPDATE reasoning_jobs
        SET
          status = 'cancelled',
          completed_at = ?
        WHERE id = ?
          AND status IN (
            'queued',
            'running',
            'cancel_requested'
          )
      `)
      .run(
        completedAt,
        id,
      );
  }

  recoverRunningJobs(): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE reasoning_jobs
      SET
        status = 'cancelled',
        completed_at = ?
      WHERE status = 'cancel_requested'
    `).run(now);

    this.db
      .prepare(`
        UPDATE reasoning_jobs
        SET
          status = 'queued',
          started_at = NULL,
          next_attempt_at = NULL,
          attempt = CASE
            WHEN attempt > 0 THEN attempt - 1
            ELSE 0
          END
        WHERE status = 'running'
      `)
      .run();
  }

  requeue(id: string, delayMs: number, restoreAttempt = false): void {
    const nextAttemptAt = delayMs > 0
      ? new Date(Date.now() + delayMs).toISOString()
      : null;
    this.db.prepare(`
      UPDATE reasoning_jobs
      SET
        status = 'queued',
        started_at = NULL,
        error = NULL,
        next_attempt_at = ?,
        attempt = CASE
          WHEN ? = 1 AND attempt > 0
            THEN attempt - 1
          ELSE attempt
        END
      WHERE id = ?
        AND status = 'running'
    `).run(nextAttemptAt, restoreAttempt? 1: 0, id);
  }

  purgeTerminalJobs(olderThan: string): number {
    const result = this.db.prepare(`
      DELETE FROM reasoning_jobs
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND completed_at IS NOT NULL
        AND completed_at < ?
    `).run(olderThan);

    return result.changes;
  }
}