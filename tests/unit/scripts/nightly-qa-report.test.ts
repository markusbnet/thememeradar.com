import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import path from 'path';

const PROJECT_DIR = process.cwd();
const SCRIPT_PATH = path.join(PROJECT_DIR, 'scripts/nightly-qa-report.sh');
const REPORT_PATH = path.join(PROJECT_DIR, 'QA-REPORT.md');
const STATE_PATH  = path.join(PROJECT_DIR, 'logs/qa-state.json');

function cleanUp() {
  if (existsSync(REPORT_PATH)) unlinkSync(REPORT_PATH);
}

describe('nightly-qa-report.sh', () => {
  afterEach(cleanUp);

  it('script exists at scripts/nightly-qa-report.sh', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('--dry-run exits with code 0', () => {
    expect(() => {
      execSync(`bash "${SCRIPT_PATH}" --dry-run`, { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('--dry-run creates QA-REPORT.md', () => {
    execSync(`bash "${SCRIPT_PATH}" --dry-run`, { stdio: 'pipe' });
    expect(existsSync(REPORT_PATH)).toBe(true);
  });

  it('--dry-run report contains dated heading', () => {
    execSync(`bash "${SCRIPT_PATH}" --dry-run`, { stdio: 'pipe' });
    const content = readFileSync(REPORT_PATH, 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    expect(content).toContain(`# QA Report — ${today}`);
  });

  it('--dry-run report contains all required sections', () => {
    execSync(`bash "${SCRIPT_PATH}" --dry-run`, { stdio: 'pipe' });
    const content = readFileSync(REPORT_PATH, 'utf-8');
    expect(content).toContain('## Suite results');
    expect(content).toContain('Unit/Integration tests');
    expect(content).toContain('E2E');
    expect(content).toContain('Visual regression');
    expect(content).toContain('## New failures this run');
    expect(content).toContain('## Open issues not yet fixed');
  });

  it('--dry-run appends a new entry on repeated calls', () => {
    execSync(`bash "${SCRIPT_PATH}" --dry-run`, { stdio: 'pipe' });
    execSync(`bash "${SCRIPT_PATH}" --dry-run`, { stdio: 'pipe' });
    const content = readFileSync(REPORT_PATH, 'utf-8');
    const count = (content.match(/# QA Report —/g) ?? []).length;
    expect(count).toBe(2);
  });

  it('--dry-run produces a table with suite rows', () => {
    execSync(`bash "${SCRIPT_PATH}" --dry-run`, { stdio: 'pipe' });
    const content = readFileSync(REPORT_PATH, 'utf-8');
    expect(content).toMatch(/\| Unit\/Integration tests \|/);
    expect(content).toMatch(/\| E2E.*desktop.*\|/);
    expect(content).toMatch(/\| E2E.*375/);
    expect(content).toMatch(/\| E2E.*414/);
  });
});
