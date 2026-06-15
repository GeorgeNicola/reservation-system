/**
 * generate-graphs.js
 *
 * Parses the large k6 results.json file and outputs a small
 * results-processed.json with aggregated data that graphs.html
 * can load dynamically via fetch().
 *
 * Usage:
 *   node generate-graphs.js
 */

const fs = require("fs");
const readline = require("readline");
const path = require("path");

const inputFile = path.join(__dirname, "results.json");
const outputFile = path.join(__dirname, "results-processed.json");

console.log(
  `Parsing ${inputFile} (this might take a few seconds for large files)...`,
);

const fileStream = fs.createReadStream(inputFile);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

// ─── Data structures ────────────────────────────────────────────────────────
const timeSeries = {};
const agg = {};

const SCENARIO_ORDER = [
  "hot_spot_naive",
  "hot_spot_pessimistic",
  "hot_spot_distributed",
  "hot_spot_queued",
];

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const p = JSON.parse(line);
    if (p.type !== "Point") return;

    const metric = p.metric;
    const tags = p.data.tags || {};
    const scenario = tags.scenario;
    if (!scenario || !scenario.startsWith("hot_spot")) return;

    // ── Time-series aggregation ──
    if (!timeSeries[scenario]) timeSeries[scenario] = {};
    const timeSec = Math.floor(new Date(p.data.time).getTime() / 1000);
    if (!timeSeries[scenario][timeSec]) {
      timeSeries[scenario][timeSec] = {
        reqs: 0,
        status201: 0,
        status202: 0,
        status409: 0,
        status503: 0,
        durationSum: 0,
        durationCount: 0,
        durations: [],
      };
    }
    const bucket = timeSeries[scenario][timeSec];

    if (metric === "http_reqs") {
      bucket.reqs += 1;
      const status = tags.status;
      if (status === "201") bucket.status201++;
      else if (status === "202") bucket.status202++;
      else if (status === "409") bucket.status409++;
      else if (status === "503") bucket.status503++;
    } else if (metric === "http_req_duration") {
      bucket.durationSum += p.data.value;
      bucket.durationCount += 1;
      bucket.durations.push(p.data.value);
    }

    // ── Aggregate data for summary table ──
    if (!agg[scenario]) {
      agg[scenario] = { durations: [], statusCodes: {} };
    }
    if (metric === "http_req_duration") {
      agg[scenario].durations.push(p.data.value);
      const status = tags.status;
      if (status) {
        agg[scenario].statusCodes[status] =
          (agg[scenario].statusCodes[status] || 0) + 1;
      }
    }
  } catch (e) {
    // Ignore malformed lines
  }
});

rl.on("close", () => {
  console.log("Finished reading file. Aggregating data...");

  // ── Process time-series for graphs ──
  const processedTimeSeries = {};

  for (const scenario of SCENARIO_ORDER) {
    if (!timeSeries[scenario]) continue;

    processedTimeSeries[scenario] = {
      throughput: [],
      latency: [],
      p95: [],
      status201: [],
      status202: [],
      status409: [],
      status503: [],
    };

    let minTime = Infinity;
    for (const t of Object.keys(timeSeries[scenario])) {
      if (parseInt(t) < minTime) minTime = parseInt(t);
    }

    for (let i = 0; i <= 35; i++) {
      const t = minTime + i;
      const b = timeSeries[scenario][t] || {
        reqs: 0,
        status201: 0,
        status202: 0,
        status409: 0,
        status503: 0,
        durationSum: 0,
        durationCount: 0,
        durations: [],
      };

      processedTimeSeries[scenario].throughput.push(b.reqs);
      processedTimeSeries[scenario].status201.push(b.status201);
      processedTimeSeries[scenario].status202.push(b.status202);
      processedTimeSeries[scenario].status409.push(b.status409);
      processedTimeSeries[scenario].status503.push(b.status503);

      const avgLatency =
        b.durationCount > 0 ? b.durationSum / b.durationCount : 0;
      processedTimeSeries[scenario].latency.push(
        Math.round(avgLatency * 10) / 10,
      );

      if (b.durations.length > 0) {
        b.durations.sort((a, c) => a - c);
        const idx = Math.floor(b.durations.length * 0.95);
        processedTimeSeries[scenario].p95.push(
          Math.round(b.durations[idx] * 10) / 10,
        );
      } else {
        processedTimeSeries[scenario].p95.push(0);
      }
    }
  }

  // ── Process aggregate summary ──
  const summary = {};
  for (const scenario of SCENARIO_ORDER) {
    if (!agg[scenario]) continue;
    const d = agg[scenario].durations.sort((a, b) => a - b);
    const len = d.length;
    if (len === 0) continue;

    const label = scenario.replace("hot_spot_", "");
    summary[label] = {
      totalRequests: len,
      throughput: (len / 30).toFixed(1),
      avgLatency: (d.reduce((a, b) => a + b, 0) / len).toFixed(1),
      medianLatency: d[Math.floor(len * 0.5)].toFixed(1),
      p95Latency: d[Math.floor(len * 0.95)].toFixed(1),
      p99Latency: d[Math.floor(len * 0.99)].toFixed(1),
      minLatency: d[0].toFixed(1),
      maxLatency: d[len - 1].toFixed(1),
      statusCodes: agg[scenario].statusCodes,
    };
  }

  // ── Write the processed data to JSON ──
  const output = {
    generatedAt: new Date().toISOString(),
    config: {
      vus: 200,
      durationPerScenario: "30s",
      hotSpot: "clinic_id=1, start_time=2025-06-10T10:00:00Z",
    },
    summary,
    timeSeries: processedTimeSeries,
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`Processed data written to: ${outputFile}`);
  console.log(
    `File size: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`,
  );
  console.log("Open graphs.html in your browser to view the results!");
});
