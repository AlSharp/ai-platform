import "dotenv/config";
import Fastify from "fastify";
import { getOllamaModel, reasonWithOllama } from "./providers/ollama";
import { ReasoningRequest, ReasoningResponse } from "./types/reasoning";

const app = Fastify({
  logger: true,
});

app.get("/health", async () => ({
  status: "ok",
  service: "reasoning-gateway",
}));

app.post<{
  Body: ReasoningRequest;
}>("/reason", async (request, reply) => {
  const { messages } = request.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.status(400).send({
      error: "messages is required",
    });
  }

  try {
    const content = await reasonWithOllama(messages);

    const response: ReasoningResponse = {
      provider: "ollama",
      model: getOllamaModel(),
      content,
    };

    return response;
  } catch (error) {
    request.log.error(error);

    return reply.status(502).send({
      error: "reasoning provider unavailable",
    });
  }
});

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