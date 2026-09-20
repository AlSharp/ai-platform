import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { timingSafeEqual } from "node:crypto";

function keysEqual(
  provided: string,
  expected: string,
): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(
    providedBuffer,
    expectedBuffer,
  );
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const expectedKey = process.env.GATEWAY_API_KEY;

  if (!expectedKey) {
    request.log.error(
      { event: "auth.misconfigured" },
      "GATEWAY_API_KEY is not configured",
    );

    return reply.status(503).send({
      error: "gateway authentication is not configured",
    });
  }

  const authorization = request.headers.authorization;
  const prefix = 'Bearer ';

  if (
    !authorization?.startsWith(prefix) ||
    !keysEqual(
      authorization.slice(prefix.length),
      expectedKey,
    )
  ) {
    return reply.status(401).send({
      error: "unauthorized",
    });
  }
}