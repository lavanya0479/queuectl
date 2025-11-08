
# 🧠 QueueCTL – Architecture & Design

## 1️⃣ Overview

QueueCTL is a Node.js-based command-line job queue system that manages and executes background jobs reliably.  
It supports **persistent job storage**, **multi-worker concurrency**, **automatic retries**, **exponential backoff**, and a **Dead Letter Queue (DLQ)**.

The system focuses on reliability and simplicity — ensuring that every job is processed exactly once and no data is lost even if the system restarts.

---

## 2️⃣ Core Workflow

1. **Job Enqueueing**
   - Jobs are added via CLI as JSON (e.g., `{"command": "echo hello"}`).
   - Each job gets a unique ID and is stored in SQLite with state `pending`.

2. **Worker Operation**
   - Workers continuously poll for jobs in the `pending` state.
   - Job selection and state change (`pending → processing`) happen atomically in a database transaction.
   - Jobs are executed using Node’s `spawnSync()` to ensure synchronous completion before marking them done.

3. **State Transitions**
```

pending → processing → completed
↘
(failed)
↘
retry → pending → completed
↘
(max retries)
↘
dead (DLQ)

````

4. **Failure & Retry Logic**
- Failed jobs are retried with exponential backoff:
  ```
  delay = backoff_base ^ attempts
  ```
- After reaching `max_retries`, the job moves to the **dead** state.

5. **Dead Letter Queue (DLQ)**
- Stores jobs that failed after all retries.
- You can requeue a DLQ job using:
  ```
  node queuectl.js dlq retry <jobid>
  ```

---

## 3️⃣ Database Model

**SQLite** is used for persistence.  
It keeps job data consistent across restarts with `WAL` mode for safe concurrency.

### Tables

**jobs**
| Column | Type | Purpose |
|---------|------|----------|
| id | TEXT | Unique job ID |
| command | TEXT | Shell command to execute |
| state | TEXT | Job state (pending, processing, completed, dead) |
| attempts | INTEGER | Retry counter |
| max_retries | INTEGER | Max allowed retries |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last state change |
| available_at | TEXT | When job is next eligible to run |
| last_error | TEXT | Last failure reason |

**config**
| Key | Value |
|-----|--------|
| backoff_base | Retry backoff multiplier |
| default_max_retries | Default retry limit |

---

## 5️⃣ Design Decisions & Trade-offs

| Design Choice                | Reason                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| **SQLite storage**           | Lightweight, persistent, transactional DB suitable for local queue |
| **spawnSync**                | Guarantees a job finishes before DB update (no async race)         |
| **Multi-process workers**    | True OS-level parallelism with isolation                           |
| **CLI-based management**     | Simplifies debugging and control                                   |
| **No external dependencies** | Keeps setup minimal and portable                                   |

---

## 6️⃣ Future Improvements

Future extensions can include:

* Job **timeouts** (auto-fail after X seconds)
* **Priority** queues
* **Scheduled** or delayed jobs (`run_at`)
* Job **output logging**
* **Metrics** or simple web dashboard




