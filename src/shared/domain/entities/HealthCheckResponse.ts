export interface HealthCheckResponse {
    status: string;
    timestamp: string;
    uptime: number;
    services: {
      rabbitmq: boolean;
      redis: boolean;
      mysql: boolean;
    };
  }