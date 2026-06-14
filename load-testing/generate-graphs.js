const fs = require('fs');
const readline = require('readline');
const path = require('path');

const inputFile = path.join(__dirname, 'results.json');
const outputFile = path.join(__dirname, 'graphs.html');

console.log(`Parsing ${inputFile} (this might take a few seconds for large files)...`);

const fileStream = fs.createReadStream(inputFile);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

// ─── Data structures ────────────────────────────────────────────────────────
// Time-series data: timeSeries[scenario][timestamp_sec] = { ... }
const timeSeries = {};
// Aggregate data for summary: agg[scenario] = { durations: [], statusCodes: {}, ... }
const agg = {};

const SCENARIO_ORDER = ['hot_spot_naive', 'hot_spot_pessimistic', 'hot_spot_distributed', 'hot_spot_queued'];

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const p = JSON.parse(line);
    if (p.type !== 'Point') return;

    const metric = p.metric;               // top-level field in k6 JSON output
    const tags = p.data.tags || {};
    const scenario = tags.scenario;
    if (!scenario || !scenario.startsWith('hot_spot')) return;

    // ── Time-series aggregation ──
    if (!timeSeries[scenario]) timeSeries[scenario] = {};
    const timeSec = Math.floor(new Date(p.data.time).getTime() / 1000);
    if (!timeSeries[scenario][timeSec]) {
      timeSeries[scenario][timeSec] = {
        reqs: 0, status201: 0, status202: 0, status409: 0, status503: 0,
        durationSum: 0, durationCount: 0, durations: []
      };
    }
    const bucket = timeSeries[scenario][timeSec];

    if (metric === 'http_reqs') {
      bucket.reqs += 1;
      const status = tags.status;
      if (status === '201') bucket.status201++;
      else if (status === '202') bucket.status202++;
      else if (status === '409') bucket.status409++;
      else if (status === '503') bucket.status503++;
    } else if (metric === 'http_req_duration') {
      bucket.durationSum += p.data.value;
      bucket.durationCount += 1;
      bucket.durations.push(p.data.value);
    }

    // ── Aggregate data for summary table ──
    if (!agg[scenario]) {
      agg[scenario] = { durations: [], statusCodes: {} };
    }
    if (metric === 'http_req_duration') {
      agg[scenario].durations.push(p.data.value);
      const status = tags.status;
      if (status) {
        agg[scenario].statusCodes[status] = (agg[scenario].statusCodes[status] || 0) + 1;
      }
    }
  } catch (e) {
    // Ignore malformed lines
  }
});

rl.on('close', () => {
  console.log('Finished reading file. Aggregating data...');

  // ── Process time-series for graphs ──
  const processedData = {};

  for (const scenario of SCENARIO_ORDER) {
    if (!timeSeries[scenario]) continue;

    processedData[scenario] = {
      throughput: [], latency: [], p95: [],
      status201: [], status409: [], status503: [], status202: []
    };

    // Find the first second
    let minTime = Infinity;
    for (const t of Object.keys(timeSeries[scenario])) {
      if (parseInt(t) < minTime) minTime = parseInt(t);
    }

    for (let i = 0; i <= 35; i++) {
      const t = minTime + i;
      const b = timeSeries[scenario][t] || {
        reqs: 0, status201: 0, status202: 0, status409: 0, status503: 0,
        durationSum: 0, durationCount: 0, durations: []
      };

      processedData[scenario].throughput.push(b.reqs);
      processedData[scenario].status201.push(b.status201);
      processedData[scenario].status202.push(b.status202);
      processedData[scenario].status409.push(b.status409);
      processedData[scenario].status503.push(b.status503);

      const avgLatency = b.durationCount > 0 ? (b.durationSum / b.durationCount) : 0;
      processedData[scenario].latency.push(Math.round(avgLatency * 10) / 10);

      // Calculate p95 for this second
      if (b.durations.length > 0) {
        b.durations.sort((a, c) => a - c);
        const idx = Math.floor(b.durations.length * 0.95);
        processedData[scenario].p95.push(Math.round(b.durations[idx] * 10) / 10);
      } else {
        processedData[scenario].p95.push(0);
      }
    }
  }

  // ── Process aggregate summary table ──
  const summaryData = {};
  for (const scenario of SCENARIO_ORDER) {
    if (!agg[scenario]) continue;
    const d = agg[scenario].durations.sort((a, b) => a - b);
    const len = d.length;
    if (len === 0) continue;

    const label = scenario.replace('hot_spot_', '');
    summaryData[label] = {
      totalRequests: len,
      throughput: (len / 30).toFixed(1),
      avgLatency: (d.reduce((a, b) => a + b, 0) / len).toFixed(1),
      medianLatency: d[Math.floor(len * 0.5)].toFixed(1),
      p95Latency: d[Math.floor(len * 0.95)].toFixed(1),
      p99Latency: d[Math.floor(len * 0.99)].toFixed(1),
      minLatency: d[0].toFixed(1),
      maxLatency: d[len - 1].toFixed(1),
      statusCodes: agg[scenario].statusCodes
    };
  }

  // ── Generate HTML ──
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K6 Load Test Results — Concurrency Control Comparison</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --naive: #ef4444;
      --pessimistic: #3b82f6;
      --distributed: #f59e0b;
      --queued: #10b981;
      --bg: #0f172a;
      --card: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --border: #334155;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 30px 20px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header p {
      color: var(--muted);
      font-size: 14px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      max-width: 1100px;
      margin: 0 auto 40px auto;
    }
    .summary-card {
      background: var(--card);
      border-radius: 12px;
      padding: 20px;
      border-left: 4px solid;
    }
    .summary-card.naive { border-color: var(--naive); }
    .summary-card.pessimistic { border-color: var(--pessimistic); }
    .summary-card.distributed { border-color: var(--distributed); }
    .summary-card.queued { border-color: var(--queued); }
    .summary-card h3 {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .summary-card.naive h3 { color: var(--naive); }
    .summary-card.pessimistic h3 { color: var(--pessimistic); }
    .summary-card.distributed h3 { color: var(--distributed); }
    .summary-card.queued h3 { color: var(--queued); }
    .stat-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 3px 0;
      border-bottom: 1px solid var(--border);
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: var(--muted); }
    .stat-value { font-weight: 600; font-variant-numeric: tabular-nums; }
    .summary-table-container {
      max-width: 1100px;
      margin: 0 auto 40px auto;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border-radius: 12px;
      overflow: hidden;
      font-size: 14px;
    }
    th, td { padding: 12px 16px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th {
      background: #0f172a;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    td { border-top: 1px solid var(--border); font-variant-numeric: tabular-nums; }
    tr:hover td { background: rgba(255,255,255,0.03); }
    .chart-container {
      width: 95%;
      max-width: 1100px;
      margin: 20px auto;
      background: var(--card);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .section-title {
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: var(--muted);
      margin: 40px 0 16px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Concurrency Control Strategies — Load Test Results</h1>
    <p>200 Virtual Users × 30 seconds per scenario | Hot spot: clinic_id=1, same time slot</p>
  </div>

  <!-- Summary Cards -->
  <div class="summary-grid">
    ${Object.entries(summaryData).map(([name, s]) => `
    <div class="summary-card ${name}">
      <h3>${name === 'naive' ? '⚠️ ' : '✅ '}${name}</h3>
      <div class="stat-row"><span class="stat-label">Total Requests</span><span class="stat-value">${Number(s.totalRequests).toLocaleString()}</span></div>
      <div class="stat-row"><span class="stat-label">Throughput</span><span class="stat-value">~${s.throughput} req/s</span></div>
      <div class="stat-row"><span class="stat-label">Avg Latency</span><span class="stat-value">${s.avgLatency} ms</span></div>
      <div class="stat-row"><span class="stat-label">p95 Latency</span><span class="stat-value">${s.p95Latency} ms</span></div>
      <div class="stat-row"><span class="stat-label">Max Latency</span><span class="stat-value">${s.maxLatency} ms</span></div>
      <div class="stat-row"><span class="stat-label">Status Codes</span><span class="stat-value">${Object.entries(s.statusCodes).map(([k,v]) => k + ':' + v).join(' ')}</span></div>
    </div>
    `).join('')}
  </div>

  <!-- Full Comparison Table -->
  <div class="summary-table-container">
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          ${Object.keys(summaryData).map(n => `<th>${n.toUpperCase()}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr><td>Total Requests</td>${Object.values(summaryData).map(s => `<td>${Number(s.totalRequests).toLocaleString()}</td>`).join('')}</tr>
        <tr><td>Throughput (req/s)</td>${Object.values(summaryData).map(s => `<td>~${s.throughput}</td>`).join('')}</tr>
        <tr><td>Avg Latency (ms)</td>${Object.values(summaryData).map(s => `<td>${s.avgLatency}</td>`).join('')}</tr>
        <tr><td>Median Latency (ms)</td>${Object.values(summaryData).map(s => `<td>${s.medianLatency}</td>`).join('')}</tr>
        <tr><td>p95 Latency (ms)</td>${Object.values(summaryData).map(s => `<td>${s.p95Latency}</td>`).join('')}</tr>
        <tr><td>p99 Latency (ms)</td>${Object.values(summaryData).map(s => `<td>${s.p99Latency}</td>`).join('')}</tr>
        <tr><td>Min Latency (ms)</td>${Object.values(summaryData).map(s => `<td>${s.minLatency}</td>`).join('')}</tr>
        <tr><td>Max Latency (ms)</td>${Object.values(summaryData).map(s => `<td>${s.maxLatency}</td>`).join('')}</tr>
        <tr><td>Status Codes</td>${Object.values(summaryData).map(s => `<td>${Object.entries(s.statusCodes).map(([k,v]) => k+':'+v).join(' ')}</td>`).join('')}</tr>
      </tbody>
    </table>
  </div>

  <!-- Charts -->
  <div class="section-title">Time-Series Charts</div>

  <div class="chart-container">
    <canvas id="throughputChart"></canvas>
  </div>

  <div class="chart-container">
    <canvas id="latencyChart"></canvas>
  </div>

  <div class="chart-container">
    <canvas id="p95Chart"></canvas>
  </div>

  <div class="chart-container">
    <canvas id="statusChart"></canvas>
  </div>

  <script>
    const data = ${JSON.stringify(processedData)};
    const labels = Array.from({length: 36}, (_, i) => i + 's');

    const scenarioMeta = {
      'hot_spot_naive':       { label: 'NAIVE',       color: '#ef4444' },
      'hot_spot_pessimistic': { label: 'PESSIMISTIC', color: '#3b82f6' },
      'hot_spot_distributed': { label: 'DISTRIBUTED', color: '#f59e0b' },
      'hot_spot_queued':      { label: 'QUEUED',      color: '#10b981' }
    };

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    function makeDatasets(metricKey) {
      return Object.keys(data).map(s => ({
        label: scenarioMeta[s]?.label || s,
        data: data[s][metricKey],
        borderColor: scenarioMeta[s]?.color || '#888',
        backgroundColor: scenarioMeta[s]?.color + '20',
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
        fill: false
      }));
    }

    function makeChart(id, title, yLabel, metricKey) {
      new Chart(document.getElementById(id), {
        type: 'line',
        data: { labels, datasets: makeDatasets(metricKey) },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            title: { display: true, text: title, font: { size: 16, weight: '600' }, color: '#e2e8f0' },
            legend: { labels: { usePointStyle: true, padding: 20 } }
          },
          scales: {
            x: { title: { display: true, text: 'Time (seconds from scenario start)' } },
            y: { beginAtZero: true, title: { display: true, text: yLabel } }
          }
        }
      });
    }

    makeChart('throughputChart', 'Throughput Over Time', 'Requests / Second', 'throughput');
    makeChart('latencyChart',   'Average Latency Over Time', 'Latency (ms)', 'latency');
    makeChart('p95Chart',       'p95 Latency Over Time', 'p95 Latency (ms)', 'p95');

    // Status code stacked bar chart — one per scenario
    const statusScenarios = Object.keys(data);
    const statusDatasets = [];
    const statusLabels = statusScenarios.map(s => scenarioMeta[s]?.label || s);

    function sumArray(arr) { return arr.reduce((a, b) => a + b, 0); }

    const codeColors = { '201': '#22c55e', '202': '#3b82f6', '409': '#f59e0b', '503': '#ef4444' };
    const codeKeys = ['status201', 'status202', 'status409', 'status503'];
    const codeLabels = ['201 Created', '202 Accepted', '409 Conflict', '503 Busy'];

    codeKeys.forEach((key, idx) => {
      statusDatasets.push({
        label: codeLabels[idx],
        data: statusScenarios.map(s => sumArray(data[s][key])),
        backgroundColor: codeColors[key.replace('status', '')],
        borderWidth: 0,
        borderRadius: 4
      });
    });

    new Chart(document.getElementById('statusChart'), {
      type: 'bar',
      data: { labels: statusLabels, datasets: statusDatasets },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'HTTP Status Code Distribution', font: { size: 16, weight: '600' }, color: '#e2e8f0' },
          legend: { labels: { usePointStyle: true, padding: 20 } }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total Requests' } }
        }
      }
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(outputFile, html);
  console.log('Graphs generated successfully at: ' + outputFile);
  console.log('Double-click graphs.html to open it in your browser!');
});
