import amqplib from "amqplib";
import "dotenv/config";

const RABBITMQ_PROTOCOL = process.env.RABBITMQ_PROTOCOL || "amqp";
const RABBITMQ_HOST = process.env.RABBITMQ_HOST || "localhost";
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || 5672;
const RABBITMQ_USERNAME = process.env.RABBITMQ_USERNAME || "guest";
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || "guest";

const RABBITMQ_URL = `${RABBITMQ_PROTOCOL}://${RABBITMQ_USERNAME}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;

export class RabbitMQClient {
	private static async connect() {
		return await amqplib.connect(RABBITMQ_URL);
	}

	static async publish(
		exchange: string,
		routingKey: string,
		message: string
	) {
		const connection = await this.connect();
		const channel = await connection.createChannel();

		await channel.assertExchange(exchange, "topic", { durable: true });
		channel.publish(exchange, routingKey, Buffer.from(message), {
			persistent: true,
		});

		await channel.close();
		await connection.close();
	}

	static async createChannel() {
		const connection = await this.connect();
		return await connection.createChannel();
	}

	static async closeAll(): Promise<void> {
		try {
			console.log("Closing all RabbitMQ channels...");
			for (const channel of this.channels) {
				try {
					if (channel) {
						await channel.close();
						console.log("Channel closed.");
					}
				} catch (error) {
					console.error(
						"Error closing channel:",
						error instanceof Error ? error.message : String(error)
					);
				}
			}
			this.channels = []; // Clear channel list
			console.log("All RabbitMQ channels closed.");
		} catch (error) {
			console.error(
				"Error in closeAll:",
				error instanceof Error ? error.message : String(error)
			);
		}
	}
}
