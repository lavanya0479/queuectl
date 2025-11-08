Perfect 👍 — here’s the **final, polished version of your `README.md`** file, formatted cleanly for GitHub and ready for **copy-paste**.

Just copy **everything below**, paste it into your `README.md`, save, and push it to GitHub 👇

---

````markdown
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
````

---

## 🚀 Usage

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

See [architecture.md](architecture.md) for internal design details.

---

## 🧪 Example Workflow

```powershell
# Clean start
Remove-Item queuectl.db -Force -ErrorAction SilentlyContinue

# Enqueue jobs
node --% queuectl.js enqueue "{\"id\":\"success1\",\"command\":\"echo OK\"}"
node --% queuectl.js enqueue "{\"id\":\"fail1\",\"command\":\"exit 2\",\"max_retries\":1}"

# Start worker
node queuectl.js worker start
Start-Sleep -Seconds 3
node queuectl.js worker stop

# Check results
node queuectl.js status
node queuectl.js dlq list
```

---

## 🧩 Features

* Persistent storage with SQLite
* Configurable retry policy and backoff base
* Multi-worker concurrency (atomic job locking)
* Graceful shutdown with SIGTERM/SIGINT handling
* DLQ management with retry support
* Self-healing for stuck `processing` jobs on restart

---

## 🌟 Bonus-Ready (Extensible)

The system is designed to easily extend with:

* Job timeouts
* Priority queues
* Scheduled (`run_at`) jobs
* Job output logging
* Metrics or web dashboard

---

## ⚙️ Tech Stack

* **Node.js**
* **Commander.js** — CLI framework
* **Better-SQLite3** — Persistent DB
* **UUID** — Job ID generation
* **Child Process API** — Job execution

---

## 🎥 Demo

Include your Drive/GitHub video link here:

📹 [Demo Video Link](https://your-google-drive-demo-link-here)

---

## 🧾 Submission Checklist

* [x] Working CLI commands
* [x] Jobs persist across restarts
* [x] Retry & backoff implemented
* [x] DLQ functional
* [x] Configurable via CLI
* [x] Multi-worker support tested
* [x] Graceful shutdown + recovery
* [x] Comprehensive README & architecture file

---

**Developed by:** *Sai Lavanya*
*QueueCTL Internship Submission*

```

---

✅ That’s it — this is your **final `README.md`**.  
Once you commit and push it to GitHub, your repository will be *submission-ready and professionally formatted.*

Would you like me to also give you the short **GitHub repo tagline and topics** (the one-liner under the repo name + recommended tags)?  
Example:  
> “CLI-based job queue system with multi-worker concurrency, retries, and DLQ — built in Node.js”
```
