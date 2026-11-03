const LATENCY_WINDOW = 1000;

const counters = new Map<string, number>();
const latencies: number[] = [];
const startedAt = Date.now();

export const incrementMetric = (name: string, value = 1) => {
  counters.set(name, (counters.get(name) ?? 0) + value);
};

export const recordRequest = (statusCode: number, durationMs: number) => {
  incrementMetric("http_requests_total");
  incrementMetric(`http_requests_${Math.floor(statusCode / 100)}xx`);

  latencies.push(durationMs);

  if (latencies.length > LATENCY_WINDOW) {
    latencies.shift();
  }
};

const percentile = (sorted: number[], value: number) => {
  if (!sorted.length) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.ceil((value / 100) * sorted.length) - 1);
  return Number(sorted[Math.max(0, index)].toFixed(2));
};

const ratio = (part: number, total: number) => (total ? Number((part / total).toFixed(4)) : null);

export const getMetricsSnapshot = () => {
  const counterValues = Object.fromEntries(counters);
  const sorted = [...latencies].sort((a, b) => a - b);
  const cacheHits = counters.get("cache_hits_total") ?? 0;
  const cacheMisses = counters.get("cache_misses_total") ?? 0;
  const requests = counters.get("http_requests_total") ?? 0;

  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    counters: counterValues,
    latencyMs: {
      window: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    },
    sli: {
      availability: ratio(requests - (counters.get("http_requests_5xx") ?? 0), requests),
      cacheHitRatio: ratio(cacheHits, cacheHits + cacheMisses),
    },
  };
};

export const resetMetrics = () => {
  counters.clear();
  latencies.length = 0;
};
