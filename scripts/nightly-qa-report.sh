#!/usr/bin/env bash
# nightly-qa-report.sh — Run the full test suite and append a dated QA summary to QA-REPORT.md
#
# Usage:
#   ./scripts/nightly-qa-report.sh           # full run (runs all test suites)
#   ./scripts/nightly-qa-report.sh --dry-run # generate report skeleton without running tests

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DATE="$(date +%Y-%m-%d)"
REPORT_FILE="${PROJECT_DIR}/QA-REPORT.md"
STATE_FILE="${PROJECT_DIR}/logs/qa-state.json"
TMP_DIR="$(mktemp -d)"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in --dry-run) DRY_RUN=true ;; esac
done

trap 'rm -rf "${TMP_DIR}"' EXIT

# Load NVM / ensure node is on PATH
export NVM_DIR="${HOME:-/Users/markbnet}/.nvm"
[ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh" || true
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

cd "${PROJECT_DIR}"

log() { echo "[QA REPORT $(date '+%H:%M:%S')] $*"; }
log "Starting — ${DATE} (dry-run=${DRY_RUN})"

# ─── Helper: parse Jest JSON output ─────────────────────────────────────────
# Prints: passed|failed|total|fail1;;;fail2;;;...
parse_jest() {
  local f="$1"
  python3 - "${f}" <<'PYEOF'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    passed = d.get('numPassedTests', 0)
    failed = d.get('numFailedTests', 0)
    total  = d.get('numTotalTests', 0)
    fails  = []
    for suite in d.get('testResults', []):
        for t in suite.get('testResults', []):
            if t.get('status') == 'failed':
                anc   = ' > '.join(t.get('ancestorTitles', []))
                title = t.get('title', '')
                fails.append((anc + ' > ' + title) if anc else title)
    print(f"{passed}|{failed}|{total}|{';;;'.join(fails)}")
except Exception as e:
    sys.stderr.write(f"parse_jest error: {e}\n")
    print("0|0|0|")
PYEOF
}

# ─── Helper: parse Playwright JSON reporter output ───────────────────────────
# Prints: passed|failed|fail1;;;fail2;;;...
parse_pw() {
  local f="$1"
  python3 - "${f}" <<'PYEOF'
import json, sys
try:
    d      = json.load(open(sys.argv[1]))
    stats  = d.get('stats', {})
    passed = stats.get('expected', 0)
    failed = stats.get('unexpected', 0)
    fails  = []
    def walk(node):
        for spec in node.get('specs', []):
            for test in spec.get('tests', []):
                for r in test.get('results', []):
                    if r.get('status') not in ('expected', 'skipped'):
                        fails.append(spec.get('title','') + ' > ' + test.get('title',''))
        for child in node.get('suites', []):
            walk(child)
    for suite in d.get('suites', []):
        walk(suite)
    print(f"{passed}|{failed}|{';;;'.join(fails)}")
except Exception as e:
    sys.stderr.write(f"parse_pw error: {e}\n")
    print("0|0|")
PYEOF
}

# ─── Helper: count visual regression results from a Playwright JSON ──────────
parse_visual() {
  local f="$1"
  python3 - "${f}" <<'PYEOF'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    p = f = 0
    def walk(node):
        global p, f
        file_path = node.get('file') or ''
        for spec in node.get('specs', []):
            if 'visual' in file_path.lower() or 'visual' in (spec.get('title') or '').lower():
                for t in spec.get('tests', []):
                    for r in t.get('results', []):
                        if r.get('status') == 'expected':   p += 1
                        elif r.get('status') in ('unexpected', 'flaky'): f += 1
        for child in node.get('suites', []):
            walk(child)
    for suite in d.get('suites', []):
        walk(suite)
    print(f"{p} {f}")
except:
    print("0 0")
PYEOF
}

# ─── 1. Unit / Integration tests ─────────────────────────────────────────────
JEST_JSON="${TMP_DIR}/jest.json"
UNIT_PASSED=0; UNIT_FAILED=0; UNIT_TOTAL=0; UNIT_FAILS=""

if [ "${DRY_RUN}" = false ]; then
  log "Running unit/integration tests…"
  npx jest --json --outputFile="${JEST_JSON}" --forceExit 2>/dev/null || true
fi

if [ -f "${JEST_JSON}" ]; then
  raw="$(parse_jest "${JEST_JSON}" 2>/dev/null || echo "0|0|0|")"
  IFS='|' read -r UNIT_PASSED UNIT_FAILED UNIT_TOTAL UNIT_FAILS <<< "${raw}"
fi

# ─── 2. E2E — Chromium (desktop) ─────────────────────────────────────────────
PW_CHROMIUM="${TMP_DIR}/pw-chromium.json"
E2E_DESKTOP_PASSED=0; E2E_DESKTOP_FAILED=0; E2E_DESKTOP_FAILS=""

if [ "${DRY_RUN}" = false ]; then
  log "Running E2E — Chromium (desktop)…"
  PLAYWRIGHT_JSON_OUTPUT_NAME="${PW_CHROMIUM}" \
    npx playwright test --project=chromium --reporter=json 2>/dev/null || true
fi

if [ -f "${PW_CHROMIUM}" ]; then
  raw="$(parse_pw "${PW_CHROMIUM}" 2>/dev/null || echo "0|0|")"
  IFS='|' read -r E2E_DESKTOP_PASSED E2E_DESKTOP_FAILED E2E_DESKTOP_FAILS <<< "${raw}"
fi

# ─── 3. E2E — Mobile Chrome (Pixel 5 ≈ 393×851, closest to 375px) ────────────
PW_MOBILE_CHROME="${TMP_DIR}/pw-mobile-chrome.json"
E2E_MOBILE_375_PASSED=0; E2E_MOBILE_375_FAILED=0; E2E_MOBILE_375_FAILS=""

if [ "${DRY_RUN}" = false ]; then
  log "Running E2E — Mobile Chrome (375px)…"
  PLAYWRIGHT_JSON_OUTPUT_NAME="${PW_MOBILE_CHROME}" \
    npx playwright test --project="Mobile Chrome" --reporter=json 2>/dev/null || true
fi

if [ -f "${PW_MOBILE_CHROME}" ]; then
  raw="$(parse_pw "${PW_MOBILE_CHROME}" 2>/dev/null || echo "0|0|")"
  IFS='|' read -r E2E_MOBILE_375_PASSED E2E_MOBILE_375_FAILED E2E_MOBILE_375_FAILS <<< "${raw}"
fi

# ─── 4. E2E — Mobile Safari (iPhone 12 ≈ 390×844, closest to 414px) ──────────
PW_MOBILE_SAFARI="${TMP_DIR}/pw-mobile-safari.json"
E2E_MOBILE_414_PASSED=0; E2E_MOBILE_414_FAILED=0; E2E_MOBILE_414_FAILS=""

if [ "${DRY_RUN}" = false ]; then
  log "Running E2E — Mobile Safari (414px)…"
  PLAYWRIGHT_JSON_OUTPUT_NAME="${PW_MOBILE_SAFARI}" \
    npx playwright test --project="Mobile Safari" --reporter=json 2>/dev/null || true
fi

if [ -f "${PW_MOBILE_SAFARI}" ]; then
  raw="$(parse_pw "${PW_MOBILE_SAFARI}" 2>/dev/null || echo "0|0|")"
  IFS='|' read -r E2E_MOBILE_414_PASSED E2E_MOBILE_414_FAILED E2E_MOBILE_414_FAILS <<< "${raw}"
fi

# ─── 5. Visual regression (visual.spec.ts tests, extracted from chromium run) ─
VIS_PASSED=0; VIS_FAILED=0

if [ -f "${PW_CHROMIUM}" ]; then
  read -r VIS_PASSED VIS_FAILED <<< "$(parse_visual "${PW_CHROMIUM}" 2>/dev/null || echo "0 0")"
fi

# ─── 6. New failures — diff against previous run ─────────────────────────────
ALL_CURRENT_FAILS="${UNIT_FAILS};;;${E2E_DESKTOP_FAILS};;;${E2E_MOBILE_375_FAILS};;;${E2E_MOBILE_414_FAILS}"
NEW_FAILURES="None"

if [ -f "${STATE_FILE}" ]; then
  NEW_FAILURES="$(python3 - "${STATE_FILE}" "${ALL_CURRENT_FAILS}" <<'PYEOF' 2>/dev/null || echo "(comparison unavailable)"
import json, sys
try:
    prev    = set(json.load(open(sys.argv[1])).get('failures', []))
    current = set(f.strip() for f in sys.argv[2].split(';;;') if f.strip() and 'parse-error' not in f)
    new     = current - prev
    print('\n'.join(f'- {f}' for f in sorted(new)) if new else 'None')
except Exception as e:
    print(f'(comparison unavailable: {e})')
PYEOF
)"
fi

# Save current failures for the next run's diff
mkdir -p "$(dirname "${STATE_FILE}")"
python3 - "${ALL_CURRENT_FAILS}" > "${STATE_FILE}" <<'PYEOF' 2>/dev/null || true
import json, sys
fails = [f.strip() for f in sys.argv[1].split(';;;') if f.strip() and 'parse-error' not in f]
print(json.dumps({'failures': sorted(set(fails))}))
PYEOF

# ─── 7. Format markdown table row helpers ────────────────────────────────────
unit_row() {
  local passed="${1:-0}" failed="${2:-0}" total="${3:-0}"
  local denom="${total}"
  [ "${denom}" -eq 0 ] && denom=$(( passed + failed ))
  local cell="${passed}/${denom} passing"
  [ "${failed}" -gt 0 ] && cell="${cell} (**${failed} FAILING**)"
  echo "| Unit/Integration tests | ${cell} |"
}

e2e_row() {
  local label="${1}" passed="${2:-0}" failed="${3:-0}"
  local cell="${passed} passing"
  [ "${failed}" -gt 0 ] && cell="${cell} (**${failed} FAILING**)"
  echo "| ${label} | ${cell} |"
}

# ─── 8. Build report entry ───────────────────────────────────────────────────
REPORT_ENTRY="---

# QA Report — ${DATE}

## Suite results

| Suite | Result |
|-------|--------|
$(unit_row "${UNIT_PASSED}" "${UNIT_FAILED}" "${UNIT_TOTAL}")
$(e2e_row "E2E — Chromium (desktop)" "${E2E_DESKTOP_PASSED}" "${E2E_DESKTOP_FAILED}")
$(e2e_row "E2E — Mobile Chrome (375px)" "${E2E_MOBILE_375_PASSED}" "${E2E_MOBILE_375_FAILED}")
$(e2e_row "E2E — Mobile Safari (414px)" "${E2E_MOBILE_414_PASSED}" "${E2E_MOBILE_414_FAILED}")
$(e2e_row "Visual regression" "${VIS_PASSED}" "${VIS_FAILED}")
| A11y violations | Integrated into E2E suites via axe-core (failures counted above) |

## New failures this run

${NEW_FAILURES}

## Open issues not yet fixed

_Review [TODOIST-TASKS.md](TODOIST-TASKS.md) for open items and the backlog._
"

# ─── 9. Append to QA-REPORT.md ───────────────────────────────────────────────
if [ ! -f "${REPORT_FILE}" ]; then
  printf '# QA Reports — The Meme Radar\n\n_Generated by `scripts/nightly-qa-report.sh`. Each nightly run appends a new dated entry._\n' \
    > "${REPORT_FILE}"
fi

printf '%s\n' "${REPORT_ENTRY}" >> "${REPORT_FILE}"

log "Done — report appended to QA-REPORT.md"
log "  Unit/Integration: ${UNIT_PASSED}/${UNIT_TOTAL} passing (${UNIT_FAILED} failing)"
log "  E2E desktop:      ${E2E_DESKTOP_PASSED} passing (${E2E_DESKTOP_FAILED} failing)"
log "  E2E mobile 375:   ${E2E_MOBILE_375_PASSED} passing (${E2E_MOBILE_375_FAILED} failing)"
log "  E2E mobile 414:   ${E2E_MOBILE_414_PASSED} passing (${E2E_MOBILE_414_FAILED} failing)"
log "  Visual:           ${VIS_PASSED} passing (${VIS_FAILED} failing)"
