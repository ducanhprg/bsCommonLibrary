import { Request, Response } from 'express';
import { HealthCheckResponse } from '@shared/domain/entities/HealthCheckResponse';
import { RabbitMQClient } from '@shared/utils/RabbitMQClient';
import { getRedisClient } from '@shared/configs/redisConfig';
import { mainDataSource } from '@shared/configs/mysqlConfig';

const redisClient = getRedisClient();

export const healthCheck = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const healthStatus: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        rabbitmq: false,
        redis: false,
        mysql: false,
      },
    };

    // Check RabbitMQ connection
    try {
      const channel = await RabbitMQClient.createChannel();
      if (channel) {
        await channel.close();
        healthStatus.services.rabbitmq = true;
      }
    } catch (error) {
      console.error('RabbitMQ health check failed:', error);
      healthStatus.services.rabbitmq = false;
    }

    // Check Redis connection
    try {
      const pong = await redisClient.ping();
      healthStatus.services.redis = pong === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      healthStatus.services.redis = false;
    }

    // Check MySQL connection
    try {
      await mainDataSource.query('SELECT 1');
      healthStatus.services.mysql = true;
    } catch (error) {
      console.error('MySQL health check failed:', error);
      healthStatus.services.mysql = false;
    }

    // If any service is down, set overall status to 'degraded'
    if (!healthStatus.services.rabbitmq || !healthStatus.services.redis || !healthStatus.services.mysql) {
      healthStatus.status = 'degraded';
    }

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