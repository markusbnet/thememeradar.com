import '@testing-library/jest-dom';
import 'whatwg-fetch';

// Polyfill Response.json for Next.js API routes (missing in jsdom)
if (typeof Response !== 'undefined' && !Response.json) {
  Response.json = function(data: any, init?: ResponseInit) {
    const body = JSON.stringify(data);
    const response = new Response(body, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    // Ensure body can be read multiple times (for testing)
    const originalJson = response.json.bind(response);
    response.json = async function() {
      try {
        return await originalJson();
      } catch (e) {
        // If body already consumed, return parsed data
        return data;
      }
    };

    return response;
  };
}

// Polyfill Request and Response for Next.js API routes
global.Request = Request as any;
global.Response = Response as any;
global.Headers = Headers as any;

// Mock NextResponse to use our polyfilled Response.json
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      json: (data: any, init?: ResponseInit) => {
        // Use our polyfilled Response.json
        let response;
        if (Response.json) {
          response = Response.json(data, init);
        } else {
          // Fallback
          const body = JSON.stringify(data);
          response = new Response(body, {
            ...init,
            headers: {
              'Content-Type': 'application/json',
              ...init?.headers,
            },
          });
        }

        // Add cookies support for testing
        const cookies = new Map<string, string>();
        (response as any).cookies = {
          set: (name: string, value: string, options?: any) => {
            cookies.set(name, value);
            // Set the Set-Cookie header
            const cookieString = `${name}=${value}; ${options?.httpOnly ? 'HttpOnly; ' : ''}${options?.path ? `Path=${options.path}; ` : ''}${options?.maxAge ? `Max-Age=${options.maxAge}` : ''}`;
            response.headers.set('set-cookie', cookieString.trim());
          },
          get: (name: string) => cookies.get(name),
          delete: (name: string) => cookies.delete(name),
        };

        return response;
      },
    },
  };
});

// Mock uuid to avoid ESM issues in tests
jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Date.now()}-${Math.random()}`,
}));

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8080';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.USERS_TABLE_NAME = 'users';
process.env.SESSION_COOKIE_NAME = 'meme_radar_session';
process.env.SESSION_EXPIRATION_DAYS = '7';
