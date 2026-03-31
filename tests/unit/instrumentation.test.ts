describe('instrumentation — env var validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('should log error when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    const spy = jest.spyOn(console, 'error').mockImplementation();

    const { register } = await import('@/instrumentation');
    await register();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('JWT_SECRET')
    );
  });

  it('should warn when Reddit credentials are missing', async () => {
    process.env.JWT_SECRET = 'set';
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    const spy = jest.spyOn(console, 'warn').mockImplementation();

    const { register } = await import('@/instrumentation');
    await register();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('REDDIT_CLIENT_ID')
    );
  });

  it('should warn when CRON_SECRET is missing', async () => {
    process.env.JWT_SECRET = 'set';
    process.env.REDDIT_CLIENT_ID = 'set';
    process.env.REDDIT_CLIENT_SECRET = 'set';
    delete process.env.CRON_SECRET;
    const spy = jest.spyOn(console, 'warn').mockImplementation();

    const { register } = await import('@/instrumentation');
    await register();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('CRON_SECRET')
    );
  });

  it('should not log anything when all env vars are set', async () => {
    process.env.JWT_SECRET = 'set';
    process.env.REDDIT_CLIENT_ID = 'set';
    process.env.REDDIT_CLIENT_SECRET = 'set';
    process.env.CRON_SECRET = 'set';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { register } = await import('@/instrumentation');
    await register();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
