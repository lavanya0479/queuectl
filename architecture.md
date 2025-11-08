Got it 👍 — you already have your `README.md`, so here’s a **short, clean version** of `architecture.md` — simple, focused, and perfect for your repo (no extra fluff).

Just copy-paste this as your `architecture.md` file 👇

---

```markdown
# 🧠 QueueCTL – Architecture Overview

## Overview
QueueCTL is a Node.js CLI-based job queue system built with **SQLite** for persistence.  
It supports **multiple workers**, **automatic retries**, **exponential backoff**, and a **Dead Letter Queue (DLQ)**.  
Jobs survive restarts and can be safely reprocessed.

---

## Core Components

### Database
SQLite is used for job and config storage.
- **jobs** table stores each job’s state, retry count, and timestamps.
- **config** table stores system-wide settings (e.g., backoff_base, default_max_retries).

### Main Modules
- **Enqueue** → Adds new jobs to queue (`pending` state)
- **Worker** → Picks jobs atomically, executes commands, updates state
- **DLQ** → Holds failed jobs after max retries
- **Config** → Stores runtime parameters
- **Status/List** → CLI view for job progress

---

## Job Lifecycle
```

pending → processing → (completed | retry → pending | dead)

```

- Success → marked `completed`
- Failure → retried with `delay = base ^ attempts`
- After max retries → moves to `dead` (DLQ)

---

## Worker Model
- Multiple workers run concurrently via:
```

node queuectl.js worker start --count N

```
- Each worker:
- Claims one pending job (`UPDATE ... WHERE state='pending'`)
- Executes command (`spawnSync`)
- Updates DB state on success/failure
- On startup, recovers stuck `processing` jobs to `pending`
- On shutdown (SIGTERM/SIGINT), finishes current job before exiting

---

## Reliability Features
- **Atomic DB updates** prevent duplicate execution  
- **Auto recovery** resets stuck jobs  
- **Graceful shutdown** ensures clean exits  
- **Persistent DB** means jobs are never lost  

---

## Extensibility
Easily extendable for:
- Job timeouts  
- Priorities  
- Scheduled (`run_at`) jobs  
- Job output logging  
- Web or metrics dashboard  

---

**Developed by:** *Sai Lavanya*  
*QueueCTL Internship Submission*
```

---

✅ This version is **concise, professional, and readable** — perfect for your internship repo.

Would you like a short 1-line GitHub **repository description and topic tags** next (for the repo header)?
