/**
 * Guards against the onboarding regression where code references an env var
 * that no one knows to set because it isn't documented in .env.local.example.
 * Fixing the example file here should keep the predev check and the example
 * scaffold in lockstep.
 */

import fs from 'fs';
import path from 'path';
import { REQUIRED_ENV_VARS } from '../../scripts/env-required';

describe('.env.local.example', () => {
  const examplePath = path.join(process.cwd(), '.env.local.example');
  const contents = fs.readFileSync(examplePath, 'utf8');

  it.each(REQUIRED_ENV_VARS)('documents %s', (key) => {
    const pattern = new RegExp(`^${key}=`, 'm');
    expect(contents).toMatch(pattern);
  });
});
