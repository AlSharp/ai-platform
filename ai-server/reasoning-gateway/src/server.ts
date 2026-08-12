import Fastify from "fastify";

const app = Fastify({
  logger: true,
});

app.get("/health", async () => ({
  status: "ok",
  service: "reasoning-gateway",
}));

const port = Number(process.env.PORT ?? 9000);

async function start() {
  try {
    await app.listen({
      host: "0.0.0.0",
      port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();