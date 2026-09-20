const RETRY_DELAYS_MS = [
  5_000,
  15_000,
  30_000,
  60_000,
];

export function getRetryDelayMs(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length -1)];
}

export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    statusText: string
  ) {
    super(`${provider} request failed: ${status} ${statusText}`);
    this.name = 'ProviderHttpError';
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof ProviderHttpError) {
    return error.status === 429 || error.status >= 500;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("fetch failed") ||
    message.includes("socket hang up")
  );
}