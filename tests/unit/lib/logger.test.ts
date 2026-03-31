describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('should always log errors regardless of environment', async () => {
    process.env.NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const { logger } = await import('@/lib/logger');

    logger.error('test error');
    expect(spy).toHaveBeenCalledWith('test error');
  });

  it('should always log warnings regardless of environment', async () => {
    process.env.NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'warn').mockImplementation();
    const { logger } = await import('@/lib/logger');

    logger.warn('test warning');
    expect(spy).toHaveBeenCalledWith('test warning');
  });

  it('should suppress info logs in production', async () => {
    process.env.NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const { logger } = await import('@/lib/logger');

    logger.info('test info');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should log info in development', async () => {
    process.env.NODE_ENV = 'development';
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const { logger } = await import('@/lib/logger');

    logger.info('test info');
    expect(spy).toHaveBeenCalledWith('test info');
  });
});
