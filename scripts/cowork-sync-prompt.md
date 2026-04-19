# Meme Radar — Cowork Nightly Sync Prompt

> **Schedule:** 04:40 every day (runs 20 minutes before the nightly-claude.sh cron at 05:00)
>
> **Paste this entire prompt into the Cowork scheduled task configuration.**

---

You are running the nightly Meme Radar task sync. This runs at 04:40 every night.



## Context



- **Todoist project:** "memeradar" (project ID: 6gFP8vjCMprXXv7c)

- **Task planning file:** TODOIST-TASKS.md in Mark's thememeradar.com workspace folder

- **Repo location:** Mark's thememeradar.com workspace folder contains The Meme Radar codebase (thememeradar.com)

- **Claude Code logs:** `thememeradar.com/logs/` — files named `nightly-YYYY-MM-DD_HHMM.log` and `last-run-status.txt`

- **Notion shipped features database:** https://www.notion.so/2632265e5eb34bbbbcd521ff00a1ccab (data source ID: c10fedf4-799a-46d4-9944-9dc4ac051b12)



---



## Step 1: Read Claude Code logs



Read the logs directory at `thememeradar.com/logs/`. Look for:

- `last-run-status.txt` — quick summary of the most recent run

- The most recent `nightly-*.log` file (sort by filename to find latest)



Extract:

- Did Claude Code complete any tasks? Which ones?

- Were there any errors, failures, or blockers?

- How many test passes/failures were reported?

- Any notable warnings or issues worth flagging to Mark?



Keep a log summary for use in Step 5 (morning notification). If no logs exist or they are empty, note that.



---



## Step 2: Check for completed tasks



Read TODOIST-TASKS.md and look for any tasks marked `[x] COMPLETE`.



For each completed task:

1. Find the matching Todoist task by its Todoist ID (stored in the task entry). If no Todoist ID exists, skip the Todoist close step and note it.

2. Verify the work was actually done — check git log for recent commits mentioning the task, check if relevant test files exist. Use the task's Implementation Notes as a guide for what to look for.

3. If verified:

   - If it has a Todoist ID: mark it complete in Todoist using the complete-tasks tool

   - Create a row in the Notion shipped features database (see Step 3)

4. If NOT verified: change status in TODOIST-TASKS.md to `[!] FAILED` with a note explaining what's missing



Keep a record of every completed task name, verification result, and the Notion page URL created for each, for use in Step 5.



---



## Step 3: Update Notion shipped features database



For each task verified complete in Step 2, create a new page in the Notion database (data source ID: `collection://c10fedf4-799a-46d4-9944-9dc4ac051b12`) using the notion-create-pages tool.



Use this format for the page properties:

- **Name:** Task name

- **Priority:** Map p1→"p1 — Critical", p2→"p2 — High", p3→"p3 — Medium", p4→"p4 — Low"

- **date:Date Completed:start:** Today's date (YYYY-MM-DD)

- **date:Date Completed:is_datetime:** 0

- **Source:** The Source field from TODOIST-TASKS.md

- **Todoist ID:** The Todoist ID if present, otherwise "No Todoist ID"

- **Verified:** `__YES__` if verified, `__NO__` if pending

- **Verification Notes:** What was checked (commit hash, file presence, etc.)

- **Testing Complete:** `__NO__` (Mark ticks this himself after testing)



Use this format for the page content:



```

## What was shipped



[Plain-English summary of changes from the Implementation Notes in TODOIST-TASKS.md. Write for Mark, not a developer — focus on what changed from a user's perspective, with technical detail underneath.]



---



## How to test it yourself



> ⏱ **~X minutes. [Any prerequisites, e.g. "Requires being logged in."]**



[Numbered steps. Be specific — include URLs, button names, what to look for, what should NOT appear.]



---



## Verification



[Bullet list of what was checked at sync time — commit hash, file names, test counts, etc.]

```



If a task has no Implementation Notes yet, still create the Notion page but mark Verified as `__NO__` and note it's pending.



### Finding items that still need Mark's testing



After creating any new pages, you need to find ALL existing rows in the Notion database where "Testing Complete" is unchecked — these go in the morning notification.



Do this properly:

1. Use `notion-search` with `data_source_url: "collection://c10fedf4-799a-46d4-9944-9dc4ac051b12"` and a broad query (e.g. "shipped") to get all pages. Set `page_size: 25`.

2. For each result returned, call `notion-fetch` on its URL to read the full page properties.

3. Check the `Testing Complete` property — include the item in the "needs testing" list ONLY if it is `__NO__` or absent. Skip items where it is `__YES__`.

4. To keep this fast, batch the fetches — fire multiple `notion-fetch` calls in the same turn rather than one at a time.



Collect the name and Notion page URL for each unchecked item — these go in the morning notification.



---



## Step 4: Pull new tasks from Todoist



Use the find-tasks tool to get all open tasks from the memeradar project (project ID: 6gFP8vjCMprXXv7c, limit: 50).



Compare against tasks already in TODOIST-TASKS.md (match by Todoist ID). For any NEW tasks not already in the file:



1. **Check if ambiguous.** If the task description is too vague to plan (e.g. "fix the thing", "make it better"), or if Mark is asking a question rather than requesting a change (e.g. "does this need to look better?"), mark it as `[?] NEEDS CLARIFICATION` and add a comment on the Todoist task asking Mark for more details. Use the add-comments tool.



2. **If clear enough**, add it to TODOIST-TASKS.md under "Active Tasks" using this format:



```

### Task N: [Task content from Todoist]

**Todoist ID:** [id]

**Added:** [today's date]

**Status:** [ ] NEW

**Priority:** [p1/p2/p3/p4 from Todoist]

**Description:** [description from Todoist, or the content if no description]



### Plan

_To be filled by Agent 1 (Planner)_



### Tests Written

_To be filled by Agent 2 (TDD)_



### Implementation Notes

_To be filled by Agents 3 and 4_



### Review

_To be filled by Agent 5 (Reviewer)_



---

```



3. Process tasks in the order they appear in Todoist (not by priority).

4. If a task was previously marked `[?] NEEDS CLARIFICATION` and the Todoist task now has more detail in its description or comments, update it to `[ ] NEW` with the new details.



Keep a record of every new task name added for the morning notification.



---



## Step 4b: Idle queue — inject QA task if nothing to work on



After processing new Todoist tasks, check whether the active queue in TODOIST-TASKS.md has any tasks in a workable state — i.e. tasks with status `[ ] NEW` or `[~] IN PROGRESS`.



**If there are NO workable tasks** (the queue contains only `[?] NEEDS CLARIFICATION`, `[!] FAILED`, or `[x] COMPLETE` entries, or is entirely empty), inject the following QA task as the next task in TODOIST-TASKS.md. Assign it the next sequential task number (Task N+1):



```

### Task N: QA pass — test health, coverage gaps, and feature review

**Todoist ID:** _(none — auto-injected by nightly sync)_

**Added:** [today's date]

**Status:** [ ] NEW

**Priority:** p3

**Description:** The task queue is currently empty. Use this session to do a thorough QA pass across the codebase.



Work through the following in order:



1. **Fix failing and flaky tests.** Run the full test suite (`npm run test`). For every failing or intermittently failing test, investigate the root cause and fix it — either the test or the underlying code. Never skip a test; always fix the root cause.



2. **Review E2E tests.** Run Playwright E2E tests (`npm run test:e2e`). Identify any failures, flakes, or tests that are too brittle (strict mode violations, timing issues). Fix them.



3. **Identify and fill test coverage gaps.** Walk through the active features of the app — authentication, dashboard, stock detail pages, trending/fading stocks, sparkline charts, sentiment analysis, ticker detection, Reddit scanning. For each area, check: are there unit tests for the business logic? Are there integration tests for the API routes? Are there E2E tests for the critical user journeys? Add tests wherever coverage is missing or thin.



4. **Review UI consistency.** Check the UI components and pages for:

   - Spacing, alignment, and visual consistency across pages

   - Mobile responsiveness (check at 375px wide)

   - Any obvious visual regressions or broken layouts

   Log any issues found. Fix straightforward ones; add a Todoist task for anything requiring deeper design decisions.



5. **Feature completeness check.** Compare the implemented features against what CLAUDE.md specifies. Identify any gaps or incomplete implementations. Create Todoist tasks for missing features.



6. **Report findings.** After completing all of the above, update this task's Implementation Notes with a summary of: tests fixed, tests added, coverage gaps found, UI issues fixed, and any remaining issues flagged for Mark.



Only mark this task `[x] COMPLETE` when all tests are passing and you have documented your findings.



### Plan

_To be filled by Agent 1 (Planner)_



### Tests Written

_To be filled by Agent 2 (TDD)_



### Implementation Notes

_To be filled by Agents 3 and 4_



### Review

_To be filled by Agent 5 (Reviewer)_



---

```



**If there ARE workable tasks**, skip this step — do not inject the QA task.



Keep a record of whether the QA task was injected for the morning notification.



---



## Step 5: Update the sync timestamp



Update the "Last synced" line at the top of TODOIST-TASKS.md to the current date and time.



---



## Step 6: Notify Mark at 08:00



Create a Todoist task in the memeradar project:

- **Content:** "🤖 Meme Radar nightly sync — [today's date]"

- **Due date:** today at 08:00

- **Priority:** p2

- **Description:** Use the format below, including the Notion link wherever testing is mentioned:



```

CLAUDE CODE OVERNIGHT ACTIVITY:

[2-4 sentence summary from the logs — what Claude Code worked on, test results, any errors or blockers. If no log output, say so.]



COMPLETED & ADDED TO NOTION:

- [Task name] — verified via [commit / file / etc.] → [Notion page URL]

(or "None" if nothing was completed)



STILL NEEDS YOUR TESTING:

- [Task name] → [Notion page URL]

- [Task name] → [Notion page URL]

(or "None outstanding")

View all: https://www.notion.so/2632265e5eb34bbbbcd521ff00a1ccab



NEWLY ADDED TO TODOIST-TASKS.md:

- [Task name] (priority)

(or "None" if no new tasks)



QA TASK INJECTED:

Yes — queue was empty, QA pass task added as Task N

(or "No — queue has workable tasks")



NEEDS YOUR CLARIFICATION:

- [Task name] — I commented asking: "[what you asked]"

(or "None")



FAILED VERIFICATION:

- [Task name] — [reason]

(or "None")



CURRENT QUEUE:

- [ ] NEW: [task name] (p1)

- [~] IN PROGRESS: [task name]

- [?] NEEDS CLARIFICATION: [task name]

- [!] FAILED: [task name]



Total: X tasks in queue

```



---



## Important Rules



- Do NOT implement any tasks yourself. You are only syncing, verifying, and notifying.

- Do NOT modify any code in the repo. Only modify TODOIST-TASKS.md.

- If a task in Todoist has already been added to TODOIST-TASKS.md (matching Todoist ID), do NOT duplicate it. Skip it.

- Always read TODOIST-TASKS.md before making any changes to understand current state.

- When creating Notion pages, write the "How to test it yourself" section for Mark as a non-developer — clear steps, real URLs, specific things to look for.

- When listing items that need testing in the morning notification, ONLY include items where you have confirmed `Testing Complete = __NO__` by actually fetching the Notion page. Do not assume — check every time.

- Only inject the QA task once — if a QA task already exists in the queue (check for "QA pass" or "auto-injected by nightly sync" in the task descriptions), do not add another one.
