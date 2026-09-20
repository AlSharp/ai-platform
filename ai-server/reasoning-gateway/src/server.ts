import 'dotenv/config';
import Fastify from 'fastify';
import { ReasoningRequest } from './types/reasoning';
import { reasoningSchema } from './schemas/reasoning';
import { getJobSchema, cancelJobSchema } from './schemas/jobs';
import { jobRepository } from './jobs';
import { ReasoningWorker } from './jobs/worker';
import { toJobStatusResponse } from './jobs/mapper';
import { JobCleanup } from './jobs/cleanup';
import { authenticate } from './auth';

const app = Fastify({
  logger: true,
});

const ollamaWorker = new ReasoningWorker(
  'local',
  Number(process.env.OLLAMA_MAX_CONCURRENT ?? 1),
  jobRepository,
  app.log
);

const hermesWorker = new ReasoningWorker(
  'frontier',
  Number(process.env.HERMES_MAX_CONCURRENT ?? 1),
  jobRepository,
  app.log
);

const jobCleanup = new JobCleanup(jobRepository, app.log);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  app.log.info(
    {
      event: "gateway.shutdown",
      signal,
    },
    "Reasoning Gateway shutting down",
  );

  try {
    jobCleanup.stop();
    await Promise.all([
      ollamaWorker.stop(),
      hermesWorker.stop(),
    ])

    await app.close();

    jobRepository.close();

    app.log.info(
      { event: "gateway.stopped" },
      "Reasoning Gateway stopped",
    );

    process.exit(0);
  } catch (error) {
    app.log.error(
      {
        event: "gateway.shutdown_failed",
        err: error,
      },
      "Reasoning Gateway shutdown failed",
    );

    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

app.get('/health', async () => ({
  status: 'ok',
  service: 'reasoning-gateway',
}));

app.get("/ready", async (_request, reply) => {
  const database = jobRepository.isHealthy();
  const localWorker = ollamaWorker.isRunning();
  const frontierWorker = hermesWorker.isRunning();

  const ready =
    database &&
    localWorker &&
    frontierWorker;

  return reply
    .status(ready ? 200 : 503)
    .send({
      status: ready ? "ready" : "not_ready",
      database,
      workers: {
        local: localWorker,
        frontier: frontierWorker,
      },
    });
});

app.post<{
  Body: ReasoningRequest;
}>('/reason', { schema: reasoningSchema, preHandler: authenticate }, async (request, reply) => {
  try {
    const job = jobRepository.create(request.body);

    const worker =
      job.request.tier === "frontier"
        ? hermesWorker
        : ollamaWorker;

    worker.wake();

    request.log.info(
      {
        event: "job.created",
        jobId: job.id,
        tier: job.request.tier,
      },
      "Reasoning job created",
    );

    return reply.status(202).send({
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    request.log.error(error);

    return reply.status(502).send({
      error: 'reasoning provider unavailable',
    });
  }
});

app.get<{ Params: { jobId: string } }>(
  "/jobs/:jobId",
  { schema: getJobSchema, preHandler: authenticate },
  async (request, reply) => {
    const job = jobRepository.get(request.params.jobId);

    if (!job) {
      return reply.status(404).send({
        error: "job not found",
      });
    }

    return toJobStatusResponse(job);
  },
);

app.post<{ Params: { jobId: string } }>(
  "/jobs/:jobId/cancel",
  { schema: cancelJobSchema, preHandler: authenticate },
  async (request, reply) => {
    const { jobId } = request.params;

    const job = jobRepository.get(jobId);

    if (!job) {
      return reply.status(404).send({
        error: "job not found",
      });
    }

    const accepted = jobRepository.requestCancel(jobId);

    if (!accepted) {
      return reply.status(409).send({
        error: "job cannot be cancelled",
        status: job.status,
      });
    }

    if (job.status === 'running') {
      const worker = job.request.tier === 'frontier'
       ? hermesWorker
       : ollamaWorker;

       worker.cancel(jobId);
    }

    const updated = jobRepository.get(jobId);

    request.log.info(
      {
        event: "job.cancel_requested",
        jobId,
        status: updated?.status,
      },
      "Reasoning job cancellation requested",
    );

    return reply.send(
      updated
        ? toJobStatusResponse(updated)
        : { error: "job not found" },
    );
  },
);

const port = Number(process.env.PORT ?? 9000);

async function start() {
  try {
    jobRepository.recoverRunningJobs();

    ollamaWorker.start();
    hermesWorker.start();
    jobCleanup.start();

    await app.listen({
      host: '0.0.0.0',
      port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();