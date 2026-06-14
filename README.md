## Step 2 — Verify the stack

# Health check — should alternate between backend-1 and backend-2 (load balancer)

curl http://localhost/health
curl http://localhost/health
curl http://localhost/health

# Seed data visible?

curl "http://localhost/stats/double-bookings?clinic_id=1&start_time=2025-06-10T09:00:00Z&end_time=2025-06-10T11:00:00Z"

## Step 3 — Smoke test each strategy

# 1. Naive — book a slot (should return 201)

curl -s -X POST http://localhost/reservations/naive \
 -H "Content-Type: application/json" \
 -d "{\"clinic_id\":1,\"patient_id\":6,\"service_id\":1,\"start_time\":\"2025-07-01T09:00:00Z\"}" | jq

# 2. Pessimistic — book a different slot

curl -s -X POST http://localhost/reservations/pessimistic \
 -H "Content-Type: application/json" \
 -d "{\"clinic_id\":1,\"patient_id\":7,\"service_id\":1,\"start_time\":\"2025-07-01T10:00:00Z\"}" | jq

# 3. Distributed lock

curl -s -X POST http://localhost/reservations/distributed-lock \
 -H "Content-Type: application/json" \
 -d "{\"clinic_id\":1,\"patient_id\":8,\"service_id\":1,\"start_time\":\"2025-07-01T11:00:00Z\"}" | jq

# 4. Queued — returns 202 with a job_id

curl -s -X POST http://localhost/reservations/queued \
 -H "Content-Type: application/json" \
 -d "{\"clinic_id\":1,\"patient_id\":9,\"service_id\":1,\"start_time\":\"2025-07-01T12:00:00Z\"}" | jq

# 5. Poll the queued job status (replace 1 with actual job_id from step 4)

curl -s http://localhost/jobs/1 | jq

## Step 4 — Run the k6 load tests

# From the project root

k6 run load-testing/k6-script.js

# OR save results for dissertation analysis

k6 run --out json=load-testing/results.json load-testing/k6-script.js

## Step 5 — Check for double bookings (key dissertation evidence)

curl -s "http://localhost/stats/double-bookings?clinic_id=1&start_time=2025-06-10T10:00:00Z&end_time=2025-06-10T10:30:00Z" | jq

## Step 6 — Reset between test runs

# From the backend/ folder:

npm run docker:reset # stops containers + deletes volumes (full DB wipe)
npm run docker:up # rebuild and restart fresh
