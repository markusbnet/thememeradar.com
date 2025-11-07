/**
 * Health Check Endpoint
 * Returns the health status of the application and its dependencies
 */

import { NextResponse } from 'next/server';
import { docClient, TABLES } from '@/lib/db/dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: {
    database: 'ok' | 'error';
    reddit?: 'ok' | 'error';
  };
  error?: string;
}

/**
 * GET /api/health
 * Returns health status of the application
 */
export async function GET() {
  const timestamp = Date.now();
  const services: HealthStatus['services'] = {
    database: 'error',
  };

  try {
    // Check DynamoDB connectivity by listing tables
    await docClient.send(
      new ScanCommand({
        TableName: TABLES.USERS,
        Limit: 1,
      })
    );
    services.database = 'ok';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        services,
        error: `Database connection failed: ${message}`,
      } as HealthStatus,
      { status: 503 }
    );
  }

  // Overall status
  const allHealthy = Object.values(services).every(s => s === 'ok');
  const status: HealthStatus['status'] = allHealthy ? 'healthy' : 'degraded';

  return NextResponse.json(
    {
      status,
      timestamp,
      services,
    } as HealthStatus,
    { status: status === 'healthy' ? 200 : 503 }
  );
}
