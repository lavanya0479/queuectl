#!/usr/bin/env node

/**
 * queuectl.js - Node.js CLI job queue with workers, retries, exponential backoff and DLQ.
 *
 * Usage:
 *  node queuectl.js enqueue '{"id":"job1","command":"echo hello"}'
 *  node queuectl.js worker start --count 2
 *  node queuectl.js worker stop
 *  node queuectl.js status
 *  node queuectl.js list --state pending
 *  node queuectl.js dlq list
 *  node queuectl.js dlq retry job1
 *  node queuectl.js config set backoff_base 2
 *
 * Requires: npm install commander better-sqlite3 uuid
 */

const { program } = require('commander');
const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.QUEUECTL_DB || path.join(process.cwd(), 'queuectl.db');
const PIDFILE = path.join(process.cwd(), 'queuectl_workers.pid');
const DEFAULT_BACKOFF_BASE = 2;
const DEFAULT_MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 1000;

// Initialize DB and statements
function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT ${DEFAULT_MAX_RETRIES},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      available_at TEXT NOT NULL,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const s = db.prepare("INSERT OR IGNORE INTO config(key,value) VALUES(?,?)");
  s.run('backoff_base', String(DEFAULT_BACKOFF_BASE));
  s.run('default_max_retries', String(DEFAULT_MAX_RETRIES));
  return db;
}

function nowIso() {
  return new Date().toISOString();
}

function enqueueJson(jsonStr) {
  let job;
  try { job = JSON.parse(jsonStr); }
  catch (e) { console.error("Invalid JSON:", e.message); process.exit(2); }
  const db = initDb();
  const id = job.id || uuidv4();
  const command = job.command;
  if (!command) { console.error("Job must include 'command'"); process.exit(2); }
  const max_retries = job.max_retries || parseInt(getConfig('default_max_retries') || DEFAULT_MAX_RETRIES);
  const ts = nowIso();
  const insert = db.prepare(`
    INSERT INTO jobs(id,command,state,attempts,max_retries,created_at,updated_at,available_at)
    VALUES(?,?,?,?,?,?,?,?)
  `);
  try {
    insert.run(id, command, 'pending', 0, max_retries, ts, ts, ts);
    console.log(`Enqueued job ${id}`);
  } catch (e) {
    console.error("Failed to enqueue:", e.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

function getConfig(key) {
  const db = initDb();
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  db.close();
  return row ? row.value : null;
}

function setConfig(key, value) {
  const db = initDb();
  db.prepare("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)").run(key, String(value));
  db.close();
  console.log(`Config ${key} = ${value}`);
}

// List jobs by state or all
function listJobs(state) {
  const db = initDb();
  let rows;
  if (state) rows = db.prepare("SELECT * FROM jobs WHERE state = ? ORDER BY created_at").all(state);
  else rows = db.prepare("SELECT * FROM jobs ORDER BY created_at").all();
  db.close();
  if (rows.length === 0) {
    console.log("No jobs");
    return;
  }
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }
}

// Status: counts and active workers
function status() {
  const db = initDb();
  const counts = db.prepare(`
    SELECT state, COUNT(*) AS cnt FROM jobs GROUP BY state
  `).all();
  db.close();
  console.log("Jobs by state:");
  for (const c of counts) {
    console.log(`  ${c.state}: ${c.cnt}`);
  }
  // active workers info from pidfile
  if (!fs.existsSync(PIDFILE)) {
    console.log("No workers running");
  } else {
    try {
      const raw = fs.readFileSync(PIDFILE, 'utf8');
      const pids = JSON.parse(raw);
      console.log(`Active workers: ${pids.length}`);
      pids.forEach((p, i) => console.log(`  worker-${i+1}: pid ${p}`));
    } catch (e) {
      console.log("Could not read PID file");
    }
  }
}

// DLQ listings and retry
function dlqList() {
  const db = initDb();
  const rows = db.prepare("SELECT * FROM jobs WHERE state = 'dead' ORDER BY updated_at").all();
  db.close();
  if (rows.length === 0) { console.log("DLQ empty"); return; }
  rows.forEach(r => console.log(JSON.stringify(r)));
}

function dlqRetry(id) {
  const db = initDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND state = 'dead'").get(id);
  if (!job) { console.error("Job not found in DLQ"); db.close(); process.exit(1); }
  const now = nowIso();
  db.prepare("UPDATE jobs SET state='pending', attempts=0, updated_at=?, available_at=? WHERE id=?")
    .run(now, now, id);
  console.log(`Moved ${id} from dead -> pending`);
  db.close();
}

// Worker management: start N child processes running this script with 'worker-run' subcommand.
function startWorkers(count) {
  if (fs.existsSync(PIDFILE)) {
    console.error("Workers appear to be running (pidfile exists). Stop them first or remove the pidfile.");
    process.exit(1);
  }
  const pids = [];
  for (let i = 0; i < count; ++i) {
    const cp = spawn(process.execPath, [__filename, 'worker-run'], {
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: true
    });
    pids.push(cp.pid);
    cp.unref();
    console.log(`Started worker pid=${cp.pid}`);
  }
  fs.writeFileSync(PIDFILE, JSON.stringify(pids));
}

// Stop workers gracefully by sending SIGTERM to pids in pidfile and removing pidfile
function stopWorkers() {
  if (!fs.existsSync(PIDFILE)) {
    console.error("No workers running");
    process.exit(1);
  }
  const pids = JSON.parse(fs.readFileSync(PIDFILE, 'utf8'));
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Sent SIGTERM to ${pid}`);
    } catch (e) {
      console.log(`Failed to signal ${pid}: ${e.message}`);
    }
  }
  // wait a moment and remove pidfile
  setTimeout(() => {
    try { fs.unlinkSync(PIDFILE); console.log("Workers stopped (pidfile removed)"); } catch (e) {}
    process.exit(0);
  }, 500);
}

/**
 * Worker-run loop (child process entrypoint)
 * Behavior:
 *  - loop: atomically claim one job eligible (state='pending' and available_at <= now)
 *  - increment attempts when claiming
 *  - set state='processing'
 *  - execute command via shell (spawnSync)
 *  - on success: set state='completed'
 *  - on failure: if attempts >= max_retries -> state='dead', else compute backoff and set available_at and state='pending'
 *  - handle SIGTERM to finish a job then exit
 */
function workerRunLoop() {
  const db = initDb();
  // Recover any stuck jobs from previous crashes
db.prepare("UPDATE jobs SET state='pending', updated_at=? WHERE state='processing'").run(new Date().toISOString());
  let shuttingDown = false;
  process.on('SIGTERM', () => {
    console.log('worker got SIGTERM, will exit after current job');
    shuttingDown = true;
  });
  process.on('SIGINT', () => {
    console.log('worker got SIGINT, will exit after current job');
    shuttingDown = true;
  });

  const backoffBase = parseFloat(getConfig('backoff_base') || DEFAULT_BACKOFF_BASE);

  console.log(`worker pid=${process.pid} started (backoff_base=${backoffBase})`);

  const selectStmt = db.prepare(`
    SELECT id FROM jobs
    WHERE state = 'pending' AND available_at <= ?
    ORDER BY created_at
    LIMIT 1
  `);
  const updateClaimStmt = db.prepare(`
    UPDATE jobs
    SET state = 'processing', attempts = attempts + 1, updated_at = ?
    WHERE id = ? AND state = 'pending'
  `);
  const getJobById = db.prepare("SELECT * FROM jobs WHERE id = ?");
  const updateJobStmt = db.prepare("UPDATE jobs SET state=?, updated_at=?, last_error=?, available_at=? WHERE id=?");

  while (true) {
    if (shuttingDown) { console.log('worker exiting (shutdown requested)'); db.close(); process.exit(0); }

    try {
      const now = new Date().toISOString();
      let jobId = null;
      // use transaction to atomically pick and claim
      db.transaction(() => {
        const row = selectStmt.get(now);
        if (!row) { return; }
        jobId = row.id;
        const r = updateClaimStmt.run(now, jobId);
        if (r.changes === 0) {
          jobId = null;
        }
      })();

      if (!jobId) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, POLL_INTERVAL_MS);
        continue;
      }

      // fetch claimed job (attempts now reflect the increment)
      const job = getJobById.get(jobId);
      if (!job) continue;
      console.log(`worker ${process.pid} picked ${job.id} (attempts=${job.attempts}/${job.max_retries}) command=${job.command}`);

      // Execute command (synchronously) through shell

const spawnSync = require('child_process').spawnSync;
let res;
if (process.platform === 'win32') {
  // use cmd /C on Windows so we get a proper exit code
  res = spawnSync('cmd', ['/C', job.command], { stdio: 'inherit' });
} else {
  // on Unix-like, run in shell
  res = spawnSync(job.command, { shell: true, stdio: 'inherit' });
}
const rc = (res && typeof res.status === 'number') ? res.status : 1;

if (rc === 0) {
  // Success: mark completed and keep available_at = now
  const nowStr = new Date().toISOString();
  updateJobStmt.run('completed', nowStr, null, nowStr, job.id);
  console.log(`worker ${process.pid} job ${job.id} completed`);
} else {
  const attempts = job.attempts;
  const maxr = job.max_retries;
  const err = `exit_code=${rc}`;
  const nowStr = new Date().toISOString();

  if (attempts >= maxr) {
    // Job exhausted retries: mark dead, set available_at = now
    updateJobStmt.run('dead', nowStr, err, nowStr, job.id);
    console.log(`worker ${process.pid} job ${job.id} moved to dead after ${attempts} attempts`);
  } else {
    // Retry later with exponential backoff
    const backoffSec = Math.pow(backoffBase, attempts);
    const nextAvailable = new Date(Date.now() + backoffSec * 1000).toISOString();
    updateJobStmt.run('pending', nowStr, err, nextAvailable, job.id);
    console.log(`worker ${process.pid} job ${job.id} failed -> will retry after ${Math.round(backoffSec)}s (attempt ${attempts}/${maxr})`);
  }
}

    } catch (e) {
      console.error("worker loop error:", e);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
}

// CLI wiring
program
  .name('queuectl')
  .description('CLI job queue with workers, retries, exponential backoff and DLQ')
  .version('1.0.0');

program.command('enqueue')
  .argument('<json>', 'job JSON string')
  .description('Enqueue a new job')
  .action(enqueueJson);

program.command('list')
  .option('--state <state>', 'filter by state (pending, processing, completed, failed, dead)')
  .description('List jobs (optionally by state)')
  .action((opts) => listJobs(opts.state));

program.command('status').description('Show status summary & workers').action(status);

// Single dlq command object with its subcommands (fixes duplicate registration)
const dlq = program.command('dlq').description('DLQ commands');
dlq.command('list')
  .description('List DLQ (dead) jobs')
  .action(dlqList);
dlq.command('retry')
  .argument('<jobid>')
  .description('Retry job in DLQ (move back to pending)')
  .action(dlqRetry);

// config set/get
const cfg = program.command('config').description('Configuration');
cfg.command('set').argument('<key>').argument('<value>').action((k,v) => setConfig(k,v));
cfg.command('get').argument('<key>').action((k) => {
  const v = getConfig(k);
  if (v === null) console.log('not set');
  else console.log(v);
});

// worker management
const workerCmd = program.command('worker').description('Worker management');
workerCmd.command('start').option('--count <n>', 'number of workers', '1').action((opts) => {
  const n = parseInt(opts.count || '1');
  startWorkers(n);
});
workerCmd.command('stop').description('Stop workers gracefully').action(stopWorkers);

// Internal-only: run single worker loop (used by start-workers to spawn children)
program.command('worker-run').description('(internal) run a worker loop').action(() => {
  workerRunLoop();
});

// If no args show help
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
