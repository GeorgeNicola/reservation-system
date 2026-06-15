# Reservation System — Concurrency Control Demo

> **Dissertation**: Gestiunea Concurenței în Sisteme de Rezervări de Mare Trafic

A demonstration system comparing 4 concurrency control strategies for handling reservation conflicts under high traffic:

| Strategy | Endpoint | Mechanism |
|---|---|---|
| **Naive** | `POST /reservations/naive` | No locking (intentionally broken) |
| **Pessimistic** | `POST /reservations/pessimistic` | PostgreSQL advisory lock |
| **Distributed** | `POST /reservations/distributed-lock` | Redis lock + fencing token |
| **Queued** | `POST /reservations/queued` | BullMQ FIFO queue |

## Architecture

- **2× Node.js backends** behind an Nginx load balancer
- **PostgreSQL 16** for persistent storage
- **Redis 7** for distributed locking and BullMQ queues
- **BullMQ worker** for async reservation processing
- **k6** for load testing

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [k6](https://k6.io/docs/getting-started/installation/) (for load testing)
- [Node.js 20+](https://nodejs.org/) (for local development)

---

## Quick Start

### Step 1 — Start the stack

```bash
cd backend
npm run docker:up          # Builds and starts all containers (foreground)
# OR
npm run docker:up:detached # Starts in background
```

### Step 2 — Verify the stack

```bash
# Health check — should alternate between backend-1 and backend-2
curl http://localhost/health
curl http://localhost/health
```

### Step 3 — Smoke test each strategy

```bash
# 1. Naive — book a slot (returns 201)
curl -s -X POST http://localhost/reservations/naive \
 -H "Content-Type: application/json" \
 -d '{"clinic_id":1,"patient_id":6,"service_id":1,"start_time":"2025-07-01T09:00:00Z"}' | jq

# 2. Pessimistic — book a different slot
curl -s -X POST http://localhost/reservations/pessimistic \
 -H "Content-Type: application/json" \
 -d '{"clinic_id":1,"patient_id":7,"service_id":1,"start_time":"2025-07-01T10:00:00Z"}' | jq

# 3. Distributed lock
curl -s -X POST http://localhost/reservations/distributed-lock \
 -H "Content-Type: application/json" \
 -d '{"clinic_id":1,"patient_id":8,"service_id":1,"start_time":"2025-07-01T11:00:00Z"}' | jq

# 4. Queued — returns 202 with a job_id
curl -s -X POST http://localhost/reservations/queued \
 -H "Content-Type: application/json" \
 -d '{"clinic_id":1,"patient_id":9,"service_id":1,"start_time":"2025-07-01T12:00:00Z"}' | jq

# 5. Poll the queued job status
curl -s http://localhost/jobs/1 | jq
```

---

## API Endpoints

### Reservation Strategies (load-tested)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/reservations/naive` | No concurrency control |
| POST | `/reservations/pessimistic` | PostgreSQL advisory lock |
| POST | `/reservations/distributed-lock` | Redis distributed lock |
| POST | `/reservations/queued` | BullMQ async queue |
| GET | `/jobs/:id` | Poll queued job status |

### CRUD Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and get JWT token |
| GET | `/reservations/list` | List reservations (`?clinic_id=&patient_id=`) |
| GET | `/clinics` | List all clinics |
| POST | `/clinics` | Create a new clinic |
| GET | `/services` | List services (`?clinic_id=`) |
| POST | `/services` | Create a new service |

### Utility
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/stats/double-bookings` | Check for double bookings |

---

## Load Testing

### Step 4 — Run the k6 load tests

```bash
cd backend

# Run tests (terminal output only)
npm run k6:run

# OR save results for analysis
npm run k6:run:json
```

### Step 5 — Generate graphs from results

```bash
# Process the large results.json into a small results-processed.json
npm run k6:graphs

# Start a local server to view the interactive dashboard
npm run k6:serve
```

Then open **http://localhost:3333/graphs.html** in your browser.

### Step 6 — Check for double bookings

```bash
curl -s "http://localhost/stats/double-bookings?clinic_id=1&start_time=2025-06-10T10:00:00Z&end_time=2025-06-10T10:30:00Z" | jq
```

### Step 7 — Reset between test runs

```bash
npm run docker:reset    # Stops containers + deletes volumes (full DB wipe)
npm run docker:up       # Rebuild and restart fresh
```

---

## NPM Scripts Reference

All scripts are run from the `backend/` directory.

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript |
| `npm run dev` | Start backend in dev mode |
| `npm run docker:up` | Start full stack with Docker |
| `npm run docker:up:detached` | Start full stack in background |
| `npm run docker:down` | Stop all containers |
| `npm run docker:reset` | Stop containers + delete volumes |
| `npm run docker:logs` | Tail all container logs |
| `npm run k6:run` | Run k6 load tests |
| `npm run k6:run:json` | Run k6 and save results to JSON |
| `npm run k6:graphs` | Process results.json → results-processed.json |
| `npm run k6:serve` | Serve graphs dashboard on http://localhost:3333 |
