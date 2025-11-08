
# 🧩 QueueCTL – CLI Job Queue with Workers, Retries, Backoff & DLQ

**QueueCTL** is a Node.js CLI-based job queue system that supports:
- Persistent job storage (SQLite)
- Multiple worker processes
- Automatic retries with exponential backoff
- Dead Letter Queue (DLQ)
- Configurable retry and backoff parameters
- Graceful worker shutdown and auto-recovery

---

## ⚙️ Setup Instructions

### Prerequisites
- **Node.js** ≥ v16  
- **npm packages**:  
  ```bash
  npm install commander better-sqlite3 uuid

##  Usage

### Enqueue a Job

```powershell
node --% queuectl.js enqueue "{\"command\":\"echo Hello from QueueCTL\"}"
```

### Start Workers

```powershell
node queuectl.js worker start --count 2
```

### Stop Workers

```powershell
node queuectl.js worker stop
```

### List Jobs

```powershell
node queuectl.js list
```

Filter by state:

```powershell
node queuectl.js list --state completed
```

### Dead Letter Queue (DLQ)

```powershell
node queuectl.js dlq list
node queuectl.js dlq retry <jobid>
```

### Configuration

```powershell
node queuectl.js config get backoff_base
node queuectl.js config set backoff_base 3
```

### Status Summary

```powershell
node queuectl.js status
```

---

## 🔄 Job Lifecycle

| State          | Description                          |
| -------------- | ------------------------------------ |
| **pending**    | Waiting to be picked by a worker     |
| **processing** | Currently executing                  |
| **completed**  | Finished successfully (exit code 0)  |
| **dead**       | Moved to DLQ after exceeding retries |

---

## 🧠 Architecture Overview

QueueCTL is built on a simple, reliable architecture powered by **SQLite** and Node.js.
Each worker process:

* Claims a pending job atomically using SQL transactions
* Executes it synchronously via `spawnSync`
* Updates job state (`completed`, `retry`, or `dead`)
* On startup, recovers any stuck jobs (`processing → pending`)
* On shutdown, finishes current job before exit

For detailed workflow, see [architecture.md](architecture.md).

---

## 🧩 Assumptions & Trade-offs

* **SQLite** chosen for simplicity, persistence, and ACID transactions.
* **spawnSync** ensures jobs finish before status updates (no race conditions).
* Focused on **local reliability**, not distributed scalability.
* Assumes each job command is an independent shell command.
* Communication between workers happens **only through the database**.
* Prioritizes **simplicity and maintainability** over complex orchestration.

---

## 🧪 Testing Instructions

Follow these steps to verify QueueCTL functionality:

1. **Clean start**

   ```powershell
   Remove-Item queuectl.db -Force -ErrorAction SilentlyContinue
   ```

2. **Enqueue jobs**

   ```powershell
   node --% queuectl.js enqueue "{\"id\":\"success1\",\"command\":\"echo OK\"}"
   node --% queuectl.js enqueue "{\"id\":\"fail1\",\"command\":\"exit 2\",\"max_retries\":1}"
   ```

3. **Start multiple workers**

   ```powershell
   node queuectl.js worker start --count 4
   Start-Sleep -Seconds 5
   node queuectl.js worker stop
   ```

4. **Check status**

   ```powershell
   node queuectl.js status
   node queuectl.js dlq list
   ```

✅ Expected Results:

* `success1` → **completed**
* `fail1` → **dead (in DLQ)**

---

## 🧩 Features

* Persistent storage with SQLite
* Configurable retry policy and backoff base
* Multi-worker concurrency (atomic job locking)
* Graceful shutdown with SIGTERM/SIGINT handling
* DLQ management with retry support
* Self-healing for stuck `processing` jobs on restart

---

## ⚙️ Tech Stack

* **Node.js**
* **Commander.js** — CLI framework
* **Better-SQLite3** — Persistent DB
* **UUID** — Job ID generation
* **Child Process API** — Job execution

---

## 🎥 Demo

Include your video demo link here:
📹 [Demo Video Link](https://your-google-drive-demo-link-here)


---


