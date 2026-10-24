<div align="center">

# 📬 Outbox — Distributed Email Job Scheduler & Realtime Operations Dashboard

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21-000000.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.52-red.svg?logo=redis&logoColor=white)](https://docs.bullmq.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.15-005571.svg?logo=elasticsearch&logoColor=white)](https://www.elastic.co/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

**A resilient, distributed, and fault-tolerant email dispatch engine designed to schedule, throttle, and send high-volume email campaigns without dropping jobs or relying on cron jobs.**

[System Architecture](#system-architecture) •
[Key Engineering Highlights](#key-engineering-highlights) •
[Tech Stack & Justifications](#technology-stack--design-rationale) •
[Quick Start](#quick-start) •
[Failure Recovery & Guarantees](#failure-recovery--delivery-guarantees) •
[Testing & Demo Playbook](#demo--testing-playbook)

</div>

---

## 🌟 Executive Summary & Novelty

In mass outreach systems (like **ReachInbox**), scheduling and sending emails is not merely about pushing payloads to an SMTP gateway. When thousands of emails are scheduled for the exact same millisecond across multiple sending accounts, traditional naive solutions fail:
* **Cron-based schedulers** suffer from execution drift, polling bottlenecks (`SELECT ... FOR UPDATE`), database lock contention, and duplicate execution across scaled instances.
* **In-memory rate limiters** collapse the moment workers scale horizontally or restart.
* **Blind throttling** drops or fails jobs when quotas are reached instead of preserving campaign queue order.

**Outbox** addresses these distributed systems challenges with a specialized architecture:
1. **Zero-Cron Delayed Event Engine:** Powered by BullMQ and Redis sorted sets (`ZSET`), enabling exact millisecond job timing, sub-second scheduling resolution, and constant time $O(\log N)$ enqueueing.
2. **Atomic Distributed Rate Limiting via Lua Scripts:** Enforces per-sender hourly quota windows and minimum send intervals atomically across horizontal worker processes without thread contention or `sleep()` locking.
3. **Graceful Spilling (Preserved Ordering):** When a sender reaches its quota, excess jobs are rescheduled into the subsequent hour window using sequence-staggered offsets, maintaining campaign sequencing without dropping a single email.
4. **Resilient Dual-Process Topology:** The API server and BullMQ workers execute in completely decoupled processes. The API can undergo rolling updates or crashes without terminating delayed queues or interrupting active workers.
5. **Real-time Incident Automation:** Live Slack OAuth integration that triggers verifiable notifications the exact moment a sender hits hourly thresholds, facilitating proactive operational oversight.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Vite + React + Tailwind)"]
        UI["Pixel-Matched Operations UI"]
        AuthCtx["Google OAuth Session"]
    end

    subgraph API_Layer["API Gateway (Express.js / Node.js)"]
        AuthRoute["/auth (Google & Slack OAuth)"]
        CampaignRoute["POST /api/campaigns"]
        EmailRoute["GET /api/emails (Elasticsearch & Fallback)"]
        BullBoardUI["/admin/queues (Bull Board Dashboard)"]
        ReconcileBoot["Startup Reconciliation Engine"]
    end

    subgraph Storage["Storage & Queue Infrastructure"]
        PG[("PostgreSQL 16\n(Canonical Relational Source)")]
        Redis[("Redis 7 (AOF Persistence)\nDelayed Sets & Quota Counters")]
        ES[("Elasticsearch 8\nFast Search Index")]
    end

    subgraph Worker_Layer["Decoupled BullMQ Worker Cluster"]
        WorkerProc["Worker Process (Concurrency = N)"]
        LuaQuota["Lua Script: Atomic Hourly Quota"]
        LuaInterval["Lua Script: Min Spacing Guard"]
        CAS["Conditional CAS DB State Transition"]
    end

    subgraph External["External Integrations"]
        GoogleOAuth["Google Cloud Identity"]
        SlackAPI["Slack Incoming Webhooks / Bot API"]
        SMTPGateway["Ethereal Fake SMTP Gateway"]
    end

    %% Client Interactions
    UI -->|HTTP / Credentials| API_Layer
    AuthCtx -->|Google Authentication| GoogleOAuth

    %% API Interactions
    AuthRoute -->|Upsert User & Senders| PG
    AuthRoute -->|OAuth Token Exchange| SlackAPI
    CampaignRoute -->|1. Store Campaign & Emails| PG
    CampaignRoute -->|2. Enqueue Delayed Jobs| Redis
    CampaignRoute -->|3. Bulk Index Records| ES
    EmailRoute -->|Search Query| ES
    EmailRoute -.->|Fallback if ES unavail| PG
    ReconcileBoot -->|Recover Missing Jobs| PG
    ReconcileBoot -->|Re-queue Stale Jobs| Redis

    %% Worker Operations
    WorkerProc -->|Pop Due Job| Redis
    WorkerProc -->|Atomic Rate Check| LuaQuota
    WorkerProc -->|Atomic Spacing Check| LuaInterval
    LuaQuota -.->|Limit Hit Alert| SlackAPI
    WorkerProc -->|Update status: processing| PG
    WorkerProc -->|Dispatch Message| SMTPGateway
    WorkerProc -->|Update status: sent + previewUrl| PG
    WorkerProc -->|Update Index Status| ES
```

---

## 🚀 Key Engineering Highlights

### 1. Atomic Distributed Throttling (Redis Lua)
BullMQ's default rate limiter applies globally across an entire queue. In multi-sender systems, each sender has independent domain reputations and distinct hourly allowances.
* **Per-Sender Hourly Limit:** Executed via an atomic Lua script incrementing `quota:{senderId}:{YYYYMMDDHH}` with UTC-bound TTL expiration.
* **Per-Sender Minimum Spacing:** Enforces spacing (minimum 2 seconds) by comparing timestamps in `sender:{senderId}:lastSentAt`.
* **Zero Worker Sleeping:** If spacing or quota is not met, the job executes `job.moveToDelayed(nextSlot, token)` and throws `DelayedError()`. The worker thread immediately returns to the pool to process tasks for other senders without blocking concurrency.

### 2. Failure Recovery & Reconciliation Engine
If Redis is restarted or experiences a flush, in-flight delayed jobs in memory could disappear. 
* On both API and worker initialization, `reconcilePendingJobs()` scans PostgreSQL for records marked `scheduled` or `processing`.
* It verifies the presence of each `jobId` in BullMQ. Any un-queued or failed records are idempotently re-injected.
* Records stuck in `processing` state for longer than 5 minutes (indicating worker death mid-execution) are automatically transitioned back to `scheduled` and re-queued.

### 3. Idempotent State Machine (Compare-And-Swap)
To prevent duplicate email dispatch in distributed environments:
$$\text{Status Flow: } \mathbf{scheduled} \longrightarrow \mathbf{processing} \longrightarrow \mathbf{sent} \mid \mathbf{failed}$$
Workers perform an atomic conditional update:
```sql
UPDATE "Email" 
SET status = 'processing', "attemptCount" = "attemptCount" + 1 
WHERE id = $1 AND status IN ('scheduled', 'processing')
```
If another worker or retry attempt previously updated the status to `sent`, the update count returns `0` and execution immediately terminates before contacting the SMTP gateway.

---

## 🛠️ Technology Stack & Design Rationale

| Layer | Technology | Why Chosen? | Architectural Trade-offs & Benefits |
|---|---|---|---|
| **Language** | **TypeScript 5.8** | End-to-end type safety across both frontend and backend. | Eliminates subtle runtime payload mismatches; Zod schemas automatically infer compile-time types. |
| **Backend Framework** | **Express.js (Node.js)** | Battle-tested, minimalist, lightweight HTTP routing. | Low abstraction overhead, transparent middleware composition, native compatibility with Passport and Bull Board. |
| **Task Queue** | **BullMQ 5.52** | High-performance, Redis-backed distributed queue. | Operates with zero OS cron dependencies; native delayed job queues backed by Redis sorted sets (`ZSET`); robust job lifecycle hooks. |
| **Queue Storage** | **Redis 7 (Alpine)** | In-memory atomic data store with AOF persistence. | Sub-millisecond evaluation of distributed locks, rate-limit keys, and session stores; `appendonly yes` guarantees zero job loss on restart. |
| **Relational Database** | **PostgreSQL 16 (Prisma ORM)** | ACID-compliant relational data store. | Stores canonical business state, campaign metadata, encrypted OAuth tokens, and enforces data integrity (`UNIQUE(campaignId, recipient)`). |
| **Search Engine** | **Elasticsearch 8.15** | Distributed search and analytics engine. | Instant full-text fuzzy and prefix matching on millions of recipients, subjects, and bodies without putting high read load on PostgreSQL. |
| **Frontend Framework** | **React 18 + Vite** | Fast SPA build tool and declarative UI framework. | Near-instant HMR, component reusability, and clean separation between client-side state and backend services. |
| **Styling** | **Tailwind CSS** | Utility-first styling engine. | Built strictly to match the Outbox Figma design specifications with zero style runtime overhead. |
| **Email Gateway** | **Nodemailer + Ethereal** | Localized sandbox SMTP server. | Provides verifiable fake SMTP email dispatch with auto-generated web inbox preview URLs for visual verification. |
| **Authentication** | **Passport.js + Google OAuth 2.0** | Industry standard identity flow. | Secure session cookies (`connect-redis`) without managing plain passwords or authentication infrastructure. |
| **Alerting** | **Slack API / Incoming Webhooks** | Real-time push notification engine. | Immediate incident alerting when sender thresholds are reached with AES-256-GCM encrypted token storage. |

---

## 📋 Environment Configuration Reference

Copy `.env.example` to `apps/server/.env` and update the respective credentials:

```ini
# Runtime & Server
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173

# Databases & Infrastructure
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/email_scheduler?schema=public
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# Security (Minimum 16 characters)
SESSION_SECRET=dev-session-secret-change-me-16
ENCRYPTION_KEY=dev-encryption-key-change-me

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# Slack OAuth 2.0 Credentials
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_CALLBACK_URL=http://localhost:4000/auth/slack/callback

# Concurrency & Rate Limiting Knobs
WORKER_CONCURRENCY=5
MIN_SEND_INTERVAL_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200

# SMTP Gateway (Leave blank to auto-generate Ethereal accounts)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=
ETHEREAL_PASS=
```

---

## ⚡ Quick Start

### 1. Prerequisites
* **Node.js** v20.0+
* **pnpm** v9.0+
* **Docker Desktop** running

### 2. Boot Infrastructure Containers
Start PostgreSQL (port 5433), Redis (port 6379), and Elasticsearch (port 9200):
```bash
docker compose up -d
```

### 3. Install Dependencies & Synchronize Database
```bash
pnpm install
pnpm db:migrate
```

### 4. Run the Development Environment
Run each process in an independent terminal:

```bash
# Terminal 1: Express REST API & Bull Board Dashboard
pnpm dev:api

# Terminal 2: Decoupled BullMQ Worker Process
pnpm dev:worker

# Terminal 3: Vite React Web Client
pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛡️ Failure Recovery & Delivery Guarantees

### The At-Least-Once Delivery Caveat
A distributed system interacting with third-party external networks (SMTP) cannot achieve two-phase commit transactions with an external mail server.
1. The worker delivers the payload to the SMTP Gateway $\rightarrow$ SMTP responds `250 OK`.
2. The worker updates the internal database row to `status: 'sent'`.

If the worker machine experiences hardware termination, segfault, or network partition between step 1 and step 2:
* The database remains at `status: 'processing'`.
* On restart, reconciliation will find this job unacknowledged and re-queue it, creating a duplicate send.

**Mitigation Applied:**
* Idempotency keys (`campaignId:recipient`) prevent re-scheduling duplicate campaigns.
* Unique `jobId` constraints (`email_<uuid>`) enforce queue deduplication in BullMQ.
* Conditional CAS queries lock records during active transmission.
* The remaining tiny window between network socket confirmation and database commit is documented transparently as standard at-least-once distributed behavior.

---

## 🧪 Demo & Testing Playbook

### Scenario A: Real Google OAuth Authentication
1. Navigate to `http://localhost:5173/login`.
2. Click **"Login with Google"**.
3. Upon approval, you are redirected to the main dashboard displaying your real name, email, and Google profile picture.

### Scenario B: Scheduled Bulk Campaign with Throttling
1. Click **"+ Compose"** in the sidebar.
2. Enter Subject and Message body.
3. Upload `sample-leads.csv` (detects all lead recipients).
4. Set Start Time to 1 minute in the future, Delay to `2s`, and click **"Send / Schedule"**.
5. Switch to **"Scheduled"** tab $\rightarrow$ observe live countdown badges for each recipient.
6. Open the worker terminal $\rightarrow$ observe staggered sends respecting the 2-second rate limit.
7. Switch to **"Sent"** tab $\rightarrow$ click **"Ethereal preview"** to view rendered email inboxes.

### Scenario C: Atomic Quota Overflow & Slack Alert
1. In the sidebar footer, click **"Connect Slack"** and choose a notification channel.
2. In Compose, schedule 5 leads with **Hourly limit = 2**.
3. The first 2 emails will deliver immediately.
4. On the 3rd email, the Lua script detects threshold saturation:
   * A live automated message is dispatched to your connected Slack channel.
   * Jobs 3, 4, and 5 are automatically moved forward into the next hour window without dropping.

### Scenario D: Realtime Bull Board Queue Visibility
* Access `http://localhost:5173/admin/queues` directly from the dashboard header link.
* Inspect active, delayed, and completed Redis jobs with payload details and execution timings in real time.

---

<div align="center">
  <b>Built for the ReachInbox Full-Stack Scheduler Assignment</b>
</div>
