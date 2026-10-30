/**
 * Retrieval service results snapshot (INTEGRATION-BRIEF.md §4). The site has
 * no build step, so this spec is the gate: it holds the committed snapshot to
 * the schema, and a malformed or truncated file fails the suite instead of
 * rendering blanks. The fixture tests pin what the schema rejects.
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { SITE_ROOT } from "./copy-text";
import { parseSnapshot } from "./retrieval-service-schema";

// Copied by hand from the service repo once a measured run exists (brief §4).
const SNAPSHOT = path.join(SITE_ROOT, "data/retrieval-service/results.json");

// Valid and synthetic throughout. e2e/ is publicly served, so the fixture's
// own limitations entry says that nothing in it was measured.
const FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures/retrieval-service-results.json"),
  "utf-8"
);
const ASR = JSON.parse(FIXTURE).metrics.findIndex((m) => m.name === "injection_asr");

// The fixture with one change applied, as text again.
function fixtureWith(change: (doc: any) => void): string {
  const doc = JSON.parse(FIXTURE);
  change(doc);
  return JSON.stringify(doc);
}

test("the committed snapshot matches the schema", () => {
  test.skip(!fs.existsSync(SNAPSHOT), "no snapshot committed yet");
  expect(() => parseSnapshot(fs.readFileSync(SNAPSHOT, "utf-8"))).not.toThrow();
});

test("a valid fixture parses", () => {
  expect(() => parseSnapshot(FIXTURE)).not.toThrow();
});

// Required on every metric row (brief §4).
for (const field of ["n", "ci_low", "ci_high", "gated"]) {
  test(`a metric row missing ${field} fails`, () => {
    const json = fixtureWith((doc) => {
      delete doc.metrics[1][field];
    });
    expect(() => parseSnapshot(json)).toThrow(`metrics[1].${field}: missing`);
  });
}

test("an empty limitations list fails", () => {
  const json = fixtureWith((doc) => {
    doc.limitations = [];
  });
  expect(() => parseSnapshot(json)).toThrow("limitations: expected at least one entry");
});

// The likely strays: §2's display names, and the latencies from `operational`.
test("an unknown metric name fails", () => {
  for (const name of ["recall@20", "nDCG@10", "p50_latency_ms", "p95_latency_ms"]) {
    const json = fixtureWith((doc) => {
      doc.metrics[0].name = name;
    });
    expect(() => parseSnapshot(json)).toThrow(`metrics[0].name: unknown metric "${name}"`);
  }
});

// Typed as the service's design writes them.
test("judge.swap_order is a boolean and judge.prompt_version a string", () => {
  const swap = fixtureWith((doc) => {
    doc.judge.swap_order = "true";
  });
  expect(() => parseSnapshot(swap)).toThrow("judge.swap_order: expected true or false");
  const version = fixtureWith((doc) => {
    doc.judge.prompt_version = 3;
  });
  expect(() => parseSnapshot(version)).toThrow("judge.prompt_version: expected a non-empty string");
});

// Whether a row gates depends on its tier and configuration as well as its
// name: recall_at_20 gates on the deployed configuration, not on a lesser rung.
test("gated is read from each row, never inferred from its name", () => {
  const json = fixtureWith((doc) => {
    doc.metrics.push({ ...doc.metrics[1], name: "recall_at_20", gated: false });
  });
  const rows = parseSnapshot(json).metrics.filter((m) => m.name === "recall_at_20");
  expect(rows.map((m) => [m.config, m.gated])).toEqual([
    ["deployed", true],
    ["baseline", false],
  ]);
});

// The fixture's injection_asr row is null, as from a run without the
// adversarial tier. The service has not settled that row's shape, so n may be
// 0 or null, or the row may be absent. The null itself stays null.
test("a null injection_asr passes with n 0 or null, or with no row", () => {
  expect(parseSnapshot(FIXTURE).metrics[ASR].value).toBeNull();
  const nNull = fixtureWith((doc) => {
    doc.metrics[ASR].n = null;
  });
  expect(() => parseSnapshot(nNull)).not.toThrow();
  const noRow = fixtureWith((doc) => {
    doc.metrics.splice(ASR, 1);
  });
  expect(() => parseSnapshot(noRow)).not.toThrow();
});

// A positive n, a bound or a delta beside the null would each read as a
// measurement: a delta is a change in a measured value.
test("a null injection_asr fails beside a positive n, a bound or a delta", () => {
  const counted = fixtureWith((doc) => {
    doc.metrics[ASR].n = 10;
  });
  expect(() => parseSnapshot(counted)).toThrow(`metrics[${ASR}].n: expected 0 or null`);
  const bounded = fixtureWith((doc) => {
    doc.metrics[ASR].ci_low = 0;
  });
  expect(() => parseSnapshot(bounded)).toThrow(`metrics[${ASR}].ci_low: expected null`);
  const delta = fixtureWith((doc) => {
    doc.metrics[ASR].delta_vs_baseline = 0;
  });
  expect(() => parseSnapshot(delta)).toThrow(`metrics[${ASR}].delta_vs_baseline: expected null`);
});

test("no other metric may be null", () => {
  const json = fixtureWith((doc) => {
    doc.metrics[0].value = null;
  });
  expect(() => parseSnapshot(json)).toThrow("metrics[0].value: expected a number");
});
