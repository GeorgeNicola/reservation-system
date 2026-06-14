/**
 * k6 Load Testing Script
 * Dissertation: Gestiunea Concurentei in Sisteme de Rezervari de Mare Trafic
 *
 * Usage:
 *   k6 run load-testing/k6-script.js
 *   k6 run --out json=results/output.json load-testing/k6-script.js
 *
 * 4 Scenarios — all target clinic_id=1, same start_time (hot spot).
 * Purpose: demonstrate and compare concurrency control strategies under load.
 *
 * Requirements: k6 v0.46+
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Custom metrics ────────────────────────────────────────────────────────────
const doubleBookingConflicts = new Counter('double_booking_conflicts');
const reservationsCreated    = new Counter('reservations_created');
const reservationsConflict   = new Counter('reservations_conflict_409');
const reservationsBusy       = new Counter('reservations_busy_503');
const reservationsQueued     = new Counter('reservations_queued_202');
const requestDuration        = new Trend('request_duration_ms', true);

// ─── Configuration ─────────────────────────────────────────────────────────────
// Target URL — nginx load balancer (change if running without Docker)
const BASE_URL = __ENV.BASE_URL || 'http://localhost';

// All scenarios hammer the same clinic + same time slot (intentional hot spot)
const HOT_CLINIC_ID  = 1;
const HOT_START_TIME = '2025-06-10T10:00:00Z'; // Fixed slot → guarantees conflicts
const SERVICE_ID     = 1; // 'Consultatie cardiologica' (30 min) for clinic 1

// k6 generates patient IDs in [6, 105] because seed data has doctors at 1-5
// and patients at 6-105.
function randomPatientId() {
  return Math.floor(Math.random() * 100) + 6; // 6 → 105
}

// ─── Scenarios ─────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // ── Scenario 1: Naive (no protection) ────────────────────────────────
    hot_spot_naive: {
      executor:        'constant-vus',
      vus:             200,
      duration:        '30s',
      exec:            'naiveScenario',
      startTime:       '0s',
      gracefulStop:    '5s',
      tags:            { scenario: 'naive' },
    },

    // ── Scenario 2: Pessimistic locking ──────────────────────────────────
    hot_spot_pessimistic: {
      executor:        'constant-vus',
      vus:             200,
      duration:        '30s',
      exec:            'pessimisticScenario',
      startTime:       '35s', // Run after naive finishes
      gracefulStop:    '5s',
      tags:            { scenario: 'pessimistic' },
    },

    // ── Scenario 3: Distributed lock ──────────────────────────────────────
    hot_spot_distributed: {
      executor:        'constant-vus',
      vus:             200,
      duration:        '30s',
      exec:            'distributedScenario',
      startTime:       '70s', // Run after pessimistic finishes
      gracefulStop:    '5s',
      tags:            { scenario: 'distributed' },
    },

    // ── Scenario 4: FIFO Queue ────────────────────────────────────────────
    hot_spot_queued: {
      executor:        'constant-vus',
      vus:             200,
      duration:        '30s',
      exec:            'queuedScenario',
      startTime:       '105s', // Run after distributed finishes
      gracefulStop:    '5s',
      tags:            { scenario: 'queued' },
    },
  },

  // ── Thresholds ──────────────────────────────────────────────────────────────
  thresholds: {
    // Less than 1% of requests should be actual errors (5xx)
    http_req_failed: ['rate<0.01'],

    // 95th percentile response time under 500ms
    http_req_duration: ['p(95)<500'],

    // Scenario-specific duration thresholds
    'http_req_duration{scenario:naive}':       ['p(95)<300'],
    'http_req_duration{scenario:pessimistic}': ['p(95)<2000'],
    'http_req_duration{scenario:distributed}': ['p(95)<1000'],
    'http_req_duration{scenario:queued}':      ['p(95)<300'],
  },
};

// ─── Helper: build reservation request body ────────────────────────────────────
function buildBody(overrideStartTime) {
  return JSON.stringify({
    clinic_id:  HOT_CLINIC_ID,
    patient_id: randomPatientId(),
    service_id: SERVICE_ID,
    start_time: overrideStartTime || HOT_START_TIME,
  });
}

const HEADERS = { 'Content-Type': 'application/json' };

// ─── Scenario functions ────────────────────────────────────────────────────────

/**
 * Scenario 1: Naive (no locking)
 * Expected: Many 201s with duplicate start_time → double bookings!
 */
export function naiveScenario() {
  const res = http.post(`${BASE_URL}/reservations/naive`, buildBody(), {
    headers: HEADERS,
    tags:    { name: 'POST /reservations/naive' },
  });

  requestDuration.add(res.timings.duration);

  const ok = check(res, {
    'naive: status 201 or 409': (r) => r.status === 201 || r.status === 409,
    'naive: not 5xx':           (r) => r.status < 500,
  });

  if (res.status === 201) reservationsCreated.add(1);
  if (res.status === 409) reservationsConflict.add(1);
  if (res.status >= 500)  doubleBookingConflicts.add(1);

  sleep(0.1);
}

/**
 * Scenario 2: Pessimistic locking
 * Expected: Exactly 1 × 201, rest are 409
 */
export function pessimisticScenario() {
  const res = http.post(`${BASE_URL}/reservations/pessimistic`, buildBody(), {
    headers: HEADERS,
    tags:    { name: 'POST /reservations/pessimistic' },
  });

  requestDuration.add(res.timings.duration);

  check(res, {
    'pessimistic: status 201 or 409': (r) => r.status === 201 || r.status === 409,
    'pessimistic: not 5xx':           (r) => r.status < 500,
  });

  if (res.status === 201) reservationsCreated.add(1);
  if (res.status === 409) reservationsConflict.add(1);

  sleep(0.1);
}

/**
 * Scenario 3: Distributed lock (Redis)
 * Expected: Exactly 1 × 201, rest are 409 or 503 (if lock contention too high)
 */
export function distributedScenario() {
  const res = http.post(`${BASE_URL}/reservations/distributed-lock`, buildBody(), {
    headers: HEADERS,
    tags:    { name: 'POST /reservations/distributed-lock' },
  });

  requestDuration.add(res.timings.duration);

  check(res, {
    'distributed: status 201, 409, or 503': (r) =>
      r.status === 201 || r.status === 409 || r.status === 503,
    'distributed: not other 5xx': (r) => r.status !== 500 && r.status !== 502,
  });

  if (res.status === 201) reservationsCreated.add(1);
  if (res.status === 409) reservationsConflict.add(1);
  if (res.status === 503) reservationsBusy.add(1);

  sleep(0.1);
}

/**
 * Scenario 4: FIFO Queue (BullMQ)
 * Expected: All 202 (accepted), worker processes sequentially — only 1 succeeds
 */
export function queuedScenario() {
  const res = http.post(`${BASE_URL}/reservations/queued`, buildBody(), {
    headers: HEADERS,
    tags:    { name: 'POST /reservations/queued' },
  });

  requestDuration.add(res.timings.duration);

  check(res, {
    'queued: status 202': (r) => r.status === 202,
    'queued: has job_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.job_id !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (res.status === 202) {
    reservationsQueued.add(1);

    // Optionally poll the job status (demonstrates async nature)
    try {
      const body = JSON.parse(res.body);
      if (body.job_id && Math.random() < 0.05) {
        // Poll 5% of jobs to show status polling works
        sleep(0.5);
        const pollRes = http.get(`${BASE_URL}/jobs/${body.job_id}`, {
          tags: { name: 'GET /jobs/:id' },
        });
        check(pollRes, {
          'poll: status 200': (r) => r.status === 200,
          'poll: has status field': (r) => {
            try {
              const b = JSON.parse(r.body);
              return ['pending', 'processing', 'completed', 'failed'].includes(b.status);
            } catch {
              return false;
            }
          },
        });
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  sleep(0.1);
}

/**
 * Setup function: verify the backend is reachable before running tests.
 * This runs once before all scenarios.
 */
export function setup() {
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check passed': (r) => r.status === 200,
  });

  if (healthRes.status !== 200) {
    throw new Error(`Backend not reachable at ${BASE_URL}/health — status ${healthRes.status}`);
  }

  console.log(`[k6 setup] Backend healthy at ${BASE_URL}`);

  // Return config for use in teardown
  return { baseUrl: BASE_URL };
}

/**
 * Teardown: check double booking stats after naive scenario
 */
export function teardown(data) {
  sleep(2); // Allow final requests to complete

  const statsRes = http.get(
    `${data.baseUrl}/stats/double-bookings?clinic_id=${HOT_CLINIC_ID}` +
    `&start_time=${HOT_START_TIME}&end_time=2025-06-10T10:30:00Z`,
  );

  if (statsRes.status === 200) {
    try {
      const stats = JSON.parse(statsRes.body);
      console.log(
        `[k6 teardown] Clinic ${HOT_CLINIC_ID} double-booking stats:\n` +
        `  overlap_count: ${stats.overlap_count}\n` +
        `  double_booking_detected: ${stats.double_booking_detected}`,
      );

      if (stats.double_booking_detected) {
        console.warn('[k6 teardown] ⚠️  DOUBLE BOOKING CONFIRMED — naive strategy failed as expected!');
      }
    } catch {
      console.error('[k6 teardown] Could not parse stats response');
    }
  }
}
