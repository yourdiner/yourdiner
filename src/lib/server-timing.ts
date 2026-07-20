/**
 * Opt-in server-side timing spans (enable with SERVER_TIMING=1).
 * Logs duration labels without changing request behavior.
 */
export async function withServerTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.SERVER_TIMING !== "1") {
    return fn();
  }

  const start = performance.now();
  try {
    return await fn();
  } finally {
    const elapsed = performance.now() - start;
    console.info(`[timing] ${label} ${elapsed.toFixed(1)}ms`);
  }
}
