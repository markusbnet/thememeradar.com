export async function register() {
  const missing: string[] = [];
  const warned: string[] = [];

  // Critical — app cannot function without these
  const required = ['JWT_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Required for Reddit scanning (not needed for basic app operation)
  const scanRequired = ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'];
  for (const key of scanRequired) {
    if (!process.env[key]) {
      warned.push(key);
    }
  }

  // Required for scan endpoint authentication
  if (!process.env.CRON_SECRET) {
    warned.push('CRON_SECRET');
  }

  if (missing.length > 0) {
    console.error( // eslint-disable-line no-console
      `[MemeRadar] FATAL: Missing required environment variables: ${missing.join(', ')}. ` +
      'The app will not function correctly. Check your .env.local or Vercel environment settings.'
    );
  }

  if (warned.length > 0) {
    console.warn( // eslint-disable-line no-console
      `[MemeRadar] WARNING: Missing optional environment variables: ${warned.join(', ')}. ` +
      'Some features (Reddit scanning, cron jobs) may not work.'
    );
  }
}
