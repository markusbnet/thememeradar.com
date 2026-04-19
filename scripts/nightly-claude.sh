#!/bin/bash
# nightly-claude.sh — Unattended nightly Claude Code run for The Meme Radar
# Reads TODOIST-TASKS.md and works through tasks following CLAUDE.md guidelines
# Designed to run via cron at 03:30 nightly

# --- Config ---
PROJECT_DIR="/Users/markbnet/Documents/thememeradar.com"
LOG_DIR="$PROJECT_DIR/logs"
CLAUDE_BIN="/Users/markbnet/.claude/local/claude"
DATE_STAMP=$(date +%Y-%m-%d_%H%M)
LOG_FILE="$LOG_DIR/nightly-${DATE_STAMP}.log"
RESULT_FILE="$LOG_DIR/last-run-status.txt"

# --- Environment ---
export HOME="/Users/markbnet"
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/coreutils/libexec/gnubin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# --- Logging (capture everything from here) ---
mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

# --- Error handler ---
on_error() {
    local exit_code=$?
    local line_no=$1
    echo ""
    echo "!!! NIGHTLY CLAUDE FAILED !!!"
    echo "Error on line $line_no (exit code: $exit_code)"
    echo "Check log: $LOG_FILE"
    echo "Time: $(date)"

    # Write status file for easy checking
    echo "FAILED | $(date) | exit=$exit_code line=$line_no | $LOG_FILE" > "$RESULT_FILE"

    # macOS notification
    osascript -e "display notification \"Nightly Claude failed (exit $exit_code). Check logs.\" with title \"Meme Radar Nightly\"" 2>/dev/null || true
}
trap 'on_error $LINENO' ERR

set -euo pipefail

echo "============================================"
echo "Nightly Claude Run — $(date)"
echo "============================================"
echo "Project: $PROJECT_DIR"
echo "Log: $LOG_FILE"
echo ""

# --- Pre-flight checks ---
if [ ! -f "$CLAUDE_BIN" ]; then
    echo "FATAL: Claude CLI not found at $CLAUDE_BIN"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/TODOIST-TASKS.md" ]; then
    echo "FATAL: TODOIST-TASKS.md not found"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/CLAUDE.md" ]; then
    echo "FATAL: CLAUDE.md not found"
    exit 1
fi

# Check for active tasks (skip if no tasks to process)
if grep -q "No tasks yet\|_No tasks" "$PROJECT_DIR/TODOIST-TASKS.md"; then
    echo "[$(date '+%H:%M:%S')] SKIP — No active tasks in TODOIST-TASKS.md"
    echo "SKIPPED | $(date) | No active tasks | $LOG_FILE" > "$RESULT_FILE"
    exit 0
fi

# Count tasks
TASK_COUNT=$(grep -c "^### Task" "$PROJECT_DIR/TODOIST-TASKS.md" 2>/dev/null || echo "0")
echo "[$(date '+%H:%M:%S')] FOUND — $TASK_COUNT task(s) in TODOIST-TASKS.md"
echo "[$(date '+%H:%M:%S')] START — Handing off to Claude (sonnet, max effort, max 5 tasks)..."
echo ""

# --- Run Claude ---
cd "$PROJECT_DIR"

"$CLAUDE_BIN" \
    --print \
    --dangerously-skip-permissions \
    --model sonnet \
    --effort max \
    --name "nightly-memeradar-${DATE_STAMP}" \
    -p "You are running as an unattended nightly task runner for The Meme Radar project. Output clear progress milestones to stdout so the log is readable.

Use this format for milestones:
  [TASK N] PLANNING — <task name>
  [TASK N] TESTS — Writing tests for <task name>
  [TASK N] IMPLEMENTING — <brief description>
  [TASK N] TESTS PASSING — All tests green
  [TASK N] COMPLETE — <task name> done
  [TASK N] FAILED — <reason>
  [SUMMARY] X/Y tasks completed, Z failed

Now do the work:

Read /Users/markbnet/Documents/thememeradar.com/TODOIST-TASKS.md and work through a MAXIMUM of 5 tasks with status '[ ] NEW' in this run, starting from the highest priority (p1 first, then p2, then p3, then p4). Within the same priority, work in the order they appear in the file. Stop after 5 completed or failed tasks — leave the rest for future nightly runs. Follow CLAUDE.md strictly — use TDD, run all tests, and commit when ready. After each task, update TODOIST-TASKS.md with the status ([x] COMPLETE or [!] FAILED with details). At the end, add a summary comment at the bottom of the Active Tasks section with the date, tasks completed, tasks failed, and how many remain in the queue."

EXIT_CODE=$?

echo ""
echo "============================================"
echo "Claude exited with code: $EXIT_CODE"
echo "Finished at $(date)"
echo "Log saved to: $LOG_FILE"
echo "============================================"

# --- Write status file ---
if [ $EXIT_CODE -eq 0 ]; then
    echo "SUCCESS | $(date) | $LOG_FILE" > "$RESULT_FILE"
    osascript -e "display notification \"Nightly tasks completed successfully.\" with title \"Meme Radar Nightly\"" 2>/dev/null || true
else
    echo "FAILED | $(date) | exit=$EXIT_CODE | $LOG_FILE" > "$RESULT_FILE"
    osascript -e "display notification \"Nightly Claude exited with code $EXIT_CODE. Check logs.\" with title \"Meme Radar Nightly\"" 2>/dev/null || true
fi

# --- Cleanup old logs (keep 30 days) ---
find "$LOG_DIR" -name "nightly-*.log" -mtime +30 -delete 2>/dev/null || true

exit $EXIT_CODE
