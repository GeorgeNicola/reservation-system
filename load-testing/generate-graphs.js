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

// Structure to hold data: data[scenario][timestamp_sec]
const data = {};

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const p = JSON.parse(line);
    if (p.type === 'Point') {
      const metric = p.data.metric;
      const scenario = p.data.tags.scenario;
      if (!scenario) return;

      if (!data[scenario]) {
        data[scenario] = {};
      }

      const timeSec = Math.floor(new Date(p.data.time).getTime() / 1000);

      if (!data[scenario][timeSec]) {
        data[scenario][timeSec] = { reqs: 0, errors: 0, durationSum: 0, durationCount: 0 };
      }

      if (metric === 'http_reqs') {
        data[scenario][timeSec].reqs += 1;
      } else if (metric === 'http_req_failed') {
        data[scenario][timeSec].errors += p.data.value; // value is 1 if failed
      } else if (metric === 'http_req_duration') {
        data[scenario][timeSec].durationSum += p.data.value;
        data[scenario][timeSec].durationCount += 1;
      }
    }
  } catch (e) {
    // Ignore malformed lines
  }
});

rl.on('close', () => {
  console.log('Finished reading file. Aggregating data...');
  
  const processedData = {};
  
  // We want to overlay the scenarios on the same graph starting from second 0
  for (const scenario of Object.keys(data)) {
    processedData[scenario] = {
      throughput: [],
      latency: [],
      errors: []
    };
    
    // Find the first second this scenario started running
    let scenarioMinTime = Infinity;
    for (const t of Object.keys(data[scenario])) {
      if (parseInt(t) < scenarioMinTime) scenarioMinTime = parseInt(t);
    }
    
    // The scenarios ran for 30s + 5s graceful stop. 
    // We'll graph 35 seconds of data for each to align them perfectly.
    for (let i = 0; i <= 35; i++) {
      const t = scenarioMinTime + i;
      const bucket = data[scenario][t] || { reqs: 0, errors: 0, durationSum: 0, durationCount: 0 };
      
      processedData[scenario].throughput.push(bucket.reqs);
      processedData[scenario].errors.push(bucket.errors);
      
      const avgLatency = bucket.durationCount > 0 ? (bucket.durationSum / bucket.durationCount) : 0;
      processedData[scenario].latency.push(Math.round(avgLatency));
    }
  }

  // Generate HTML with Chart.js
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Load Test Scenario Comparison</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #f4f4f9; color: #333; }
    h1 { text-align: center; margin-bottom: 5px; }
    p { text-align: center; color: #666; margin-bottom: 30px; }
    .chart-container { width: 90%; max-width: 1000px; margin: 20px auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <h1>Concurrency Control Strategies Comparison</h1>
  <p>Overlaying scenarios from relative start time (t=0 to t=35s)</p>
  
  <div class="chart-container">
    <canvas id="throughputChart"></canvas>
  </div>
  
  <div class="chart-container">
    <canvas id="latencyChart"></canvas>
  </div>
  
  <div class="chart-container">
    <canvas id="errorChart"></canvas>
  </div>

  <script>
    const data = ${JSON.stringify(processedData)};
    const labels = Array.from({length: 36}, (_, i) => i + 's');
    
    // Colors matching standard Grafana/K6 aesthetics
    const colors = {
      'naive': '#ef4444',        // Red
      'pessimistic': '#3b82f6',  // Blue
      'distributed': '#f59e0b',  // Yellow/Orange
      'queued': '#10b981'        // Green
    };

    function createDatasets(metric) {
      return Object.keys(data).map(scenario => ({
        label: scenario.toUpperCase(),
        data: data[scenario][metric],
        borderColor: colors[scenario],
        backgroundColor: colors[scenario],
        borderWidth: 2,
        tension: 0.3, // smooth curves
        fill: false
      }));
    }

    new Chart(document.getElementById('throughputChart'), {
      type: 'line',
      data: { labels, datasets: createDatasets('throughput') },
      options: {
        responsive: true,
        plugins: { 
          title: { display: true, text: 'Throughput (Requests / Second)', font: { size: 16 } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: { y: { beginAtZero: true } }
      }
    });

    new Chart(document.getElementById('latencyChart'), {
      type: 'line',
      data: { labels, datasets: createDatasets('latency') },
      options: {
        responsive: true,
        plugins: { 
          title: { display: true, text: 'Average Latency (ms)', font: { size: 16 } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
    
    new Chart(document.getElementById('errorChart'), {
      type: 'line',
      data: { labels, datasets: createDatasets('errors') },
      options: {
        responsive: true,
        plugins: { 
          title: { display: true, text: 'Errors / Second', font: { size: 16 } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(outputFile, html);
  console.log('Graphs generated successfully at: ' + outputFile);
  console.log('Double-click graphs.html to open it in your browser!');
});
