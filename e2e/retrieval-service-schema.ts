/**
 * Retrieval service results snapshot (INTEGRATION-BRIEF.md §4): the shape as
 * types, and the runtime check that holds a file to it. Playwright strips the
 * types without checking them, so the check is what enforces the shape.
 */

// The names the service writes (brief §3), and no others. §2's recall@20 and
// nDCG@10 are display names for prose, and the latencies live in `operational`.
export const METRIC_NAMES = [
  "recall_at_5",
  "recall_at_20",
  "recall_at_50",
  "ndcg_at_10",
  "mrr",
  "answer_correct",
  "faithfulness",
  "citation_precision",
  "citation_recall",
  "abstention_correct",
  "injection_asr",
] as const;

type MetricName = (typeof METRIC_NAMES)[number];

export type ResultsSnapshot = {
  generated_at: string;
  git_sha: string;
  dataset: { repo: string; revision: string; tiers: Record<string, { n: number }> };
  system: { generator: string; embedder: string; reranker: string; index_version: string };
  judge: { model: string; prompt_version: string; swap_order: boolean };
  metrics: {
    name: MetricName;
    config: string;
    tier: string;
    slice: string;
    // null only on an unmeasured injection_asr row (below), where n is 0 or null.
    n: number | null;
    value: number | null;
    ci_low: number | null;
    ci_high: number | null;
    gated: boolean;
    // Set only on rows from the deployed configuration.
    delta_vs_baseline?: number | null;
    delta_ci_low?: number | null;
    delta_ci_high?: number | null;
  }[];
  ablations: {
    metric: MetricName;
    tier: string;
    from_config: string;
    to_config: string;
    delta: number;
    delta_ci_low: number;
    delta_ci_high: number;
  }[];
  operational: { p50_latency_ms: number; p95_latency_ms: number; cost_usd_total: number };
  limitations: string[];
};

// A check returns one "path: problem" line per fault, so a bad file reports
// every fault in one run.
type Check = (v: unknown, at: string) => string[];

const fault = (at: string, problem: string) => [at ? `${at}: ${problem}` : problem];
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const text: Check = (v, at) =>
  typeof v === "string" && v.trim() !== "" ? [] : fault(at, "expected a non-empty string");
// Number.isFinite, never isFinite() or Number(): both read null as 0.
const num: Check = (v, at) =>
  typeof v === "number" && Number.isFinite(v) ? [] : fault(at, "expected a number");
const count: Check = (v, at) =>
  Number.isInteger(v) && (v as number) > 0 ? [] : fault(at, "expected a positive integer");
const flag: Check = (v, at) => (typeof v === "boolean" ? [] : fault(at, "expected true or false"));
const date: Check = (v, at) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v))
    ? []
    : fault(at, "expected an ISO 8601 date");
const metricName: Check = (v, at) =>
  (METRIC_NAMES as readonly unknown[]).includes(v) ? [] : fault(at, `unknown metric ${JSON.stringify(v)}`);

// §4 makes only the deltas optional, so every other field it lists is
// required. An optional key may be absent or null.
function fields(shape: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return (v, at) => {
    if (!isRecord(v)) return fault(at, "expected an object");
    const key = (k: string) => (at ? `${at}.${k}` : k);
    return [
      ...Object.entries(shape).flatMap(([k, check]) =>
        v[k] === undefined ? fault(key(k), "missing") : check(v[k], key(k))
      ),
      ...Object.entries(optional).flatMap(([k, check]) =>
        v[k] === undefined || v[k] === null ? [] : check(v[k], key(k))
      ),
    ];
  };
}

function listOf(item: Check, { nonEmpty = false } = {}): Check {
  return (v, at) => {
    if (!Array.isArray(v)) return fault(at, "expected a list");
    if (nonEmpty && v.length === 0) return fault(at, "expected at least one entry");
    return v.flatMap((x, i) => item(x, `${at}[${i}]`));
  };
}

function mapOf(item: Check): Check {
  return (v, at) =>
    isRecord(v)
      ? Object.entries(v).flatMap(([k, x]) => item(x, `${at}.${k}`))
      : fault(at, "expected an object");
}

// `gated` is read, never inferred: whether a row gates depends on its tier and
// configuration as well as its name.
const ROW = {
  name: metricName,
  config: text,
  tier: text,
  slice: text,
  n: count,
  value: num,
  ci_low: num,
  ci_high: num,
  gated: flag,
};
const measured = fields(ROW, { delta_vs_baseline: num, delta_ci_low: num, delta_ci_high: num });

// injection_asr is null when the run had no adversarial tier. The service has
// not settled that row's shape yet, and its design does not say what n is, so
// a snapshot passes with no injection_asr row, or with value, interval and
// deltas null and n 0 or null. A positive n would let the unmeasured rate read
// as a measured one, and reading any of it as 0 would claim no attack succeeded.
const isNull: Check = (v, at) => (v === null ? [] : fault(at, "expected null, as value is null"));
const unmeasured = fields(
  {
    ...ROW,
    n: (v, at) => (v === 0 || v === null ? [] : fault(at, "expected 0 or null, as value is null")),
    value: isNull,
    ci_low: isNull,
    ci_high: isNull,
  },
  { delta_vs_baseline: isNull, delta_ci_low: isNull, delta_ci_high: isNull }
);
const metricRow: Check = (v, at) =>
  isRecord(v) && v.name === "injection_asr" && v.value === null ? unmeasured(v, at) : measured(v, at);

const SNAPSHOT = fields({
  generated_at: date,
  git_sha: text,
  dataset: fields({ repo: text, revision: text, tiers: mapOf(fields({ n: count })) }),
  system: fields({ generator: text, embedder: text, reranker: text, index_version: text }),
  judge: fields({ model: text, prompt_version: text, swap_order: flag }),
  // A snapshot without metric rows has nothing to show.
  metrics: listOf(metricRow, { nonEmpty: true }),
  ablations: listOf(
    fields({
      metric: metricName,
      tier: text,
      from_config: text,
      to_config: text,
      delta: num,
      delta_ci_low: num,
      delta_ci_high: num,
    })
  ),
  operational: fields({ p50_latency_ms: num, p95_latency_ms: num, cost_usd_total: num }),
  limitations: listOf(text, { nonEmpty: true }),
});

// Throws on bad JSON, or with every schema fault listed.
export function parseSnapshot(json: string): ResultsSnapshot {
  const doc: unknown = JSON.parse(json);
  const faults = SNAPSHOT(doc, "");
  if (faults.length) throw new Error(`results snapshot fails its schema:\n${faults.join("\n")}`);
  return doc as ResultsSnapshot;
}
