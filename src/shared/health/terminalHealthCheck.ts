import { RabbitMQClient } from "@shared/utils/RabbitMQClient";
import { getRedisClient } from "@shared/configs/redisConfig";
import {
	mainDataSource,
	getTenantDataSource,
	isConnectionHealthy,
} from "@shared/configs/mysqlConfig";
import { HealthCheckResponse } from "@shared/domain/entities/HealthCheckResponse";

const redisClient = getRedisClient();

const runHealthCheck = async (): Promise<void> => {
	try {
		const healthStatus: HealthCheckResponse = {
			status: "ok",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			services: {
				rabbitmq: false,
				redis: false,
				mysql: false,
			},
		};

		try {
			const channel = await RabbitMQClient.createChannel();
			if (channel) {
				await channel.close();
				healthStatus.services.rabbitmq = true;
			}
		} catch (error: unknown) {
			console.error(
				"RabbitMQ health check failed:",
				error instanceof Error ? error.message : String(error)
			);
			healthStatus.services.rabbitmq = false;
		}

		try {
			const pong = await redisClient.ping();
			healthStatus.services.redis = pong === "PONG";
		} catch (error: unknown) {
			console.error(
				"Redis health check failed:",
				error instanceof Error ? error.message : String(error)
			);
			healthStatus.services.redis = false;
		}

		try {
			if (!mainDataSource.isInitialized) {
				await mainDataSource.initialize();
			}
			await mainDataSource.query("SELECT 1");
			healthStatus.services.mysql = true;
		} catch (error: unknown) {
			console.error(
				"MySQL main health check failed:",
				error instanceof Error ? error.message : String(error)
			);
			healthStatus.services.mysql = false;
		}

		try {
			const testTenant = process.env.TEST_TENANT_DB;
			if (testTenant) {
				const tenantDataSource = await getTenantDataSource(testTenant);
				const isHealthy = await isConnectionHealthy(tenantDataSource);
				if (!isHealthy) {
					console.error(
						`MySQL tenant (${testTenant}) health check failed`
					);
				}
			}
		} catch (error: unknown) {
			console.error(
				"MySQL tenant health check failed:",
				error instanceof Error ? error.message : String(error)
			);
		}

		if (
			!healthStatus.services.rabbitmq ||
			!healthStatus.services.redis ||
			!healthStatus.services.mysql
		) {
			healthStatus.status = "degraded";
		}

		console.log(
			"Health check result:",
			JSON.stringify(healthStatus, null, 2)
		);
		process.exit(healthStatus.status === "ok" ? 0 : 1);
	} catch (error: unknown) {
		const errorResponse: HealthCheckResponse = {
			status: "error",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			services: {
				rabbitmq: false,
				redis: false,
				mysql: false,
			},
		};
		console.error(
			"Health check failed:",
			JSON.stringify(errorResponse, null, 2)
		);
		process.exit(1);
	}
};

runHealthCheck().catch((error: unknown) => {
	console.error(
		"Health check failed:",
		error instanceof Error ? error.message : String(error)
	);
	process.exit(1);
});
