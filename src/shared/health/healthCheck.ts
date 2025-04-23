import { Request, Response } from 'express';
import { HealthCheckResponse } from '@shared/domain/entities/HealthCheckResponse';

export const healthCheck = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const healthStatus: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    // Add response time
    const responseTime = Date.now() - startTime;
    res.set('X-Response-Time', `${responseTime}ms`);

    res.status(200).json(healthStatus);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Internal server error during health check',
    });
  }
};