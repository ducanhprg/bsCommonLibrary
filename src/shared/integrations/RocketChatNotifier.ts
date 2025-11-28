import { ErrorDetails } from '@shared/exceptions/ErrorManager';

export interface RocketChatAttachment {
    color: string;
    title: string;
    text: string;
    fields?: Array<{
        title: string;
        value: string;
        short: boolean;
    }>;
}

export interface RocketChatMessage {
    text: string;
    attachments?: RocketChatAttachment[];
}

/**
 * RocketChatNotifier - Static utility class for sending notifications to RocketChat
 *
 * Uses environment variables:
 * - ROCKETCHAT_WEBHOOK_URL: The webhook URL for RocketChat
 * - ROCKETCHAT_ENABLED: Whether RocketChat notifications are enabled (true/false)
 * - NODE_ENV: Environment (production/uat/development)
 * - SERVICE_NAME: Name of the service sending the notification
 *
 * No initialization required - just call static methods directly.
 */
export class RocketChatNotifier {
    /**
     * Send an alert to RocketChat
     * @param level - Alert level (error, info, debug, warn)
     * @param message - Alert message
     * @param context - Optional context data
     * @param errorDetails - Optional error details
     */
    static async sendAlert(
        level: 'error' | 'info' | 'debug' | 'warn',
        message: string,
        context?: Record<string, any>,
        errorDetails?: ErrorDetails
    ): Promise<void> {
        // Check if RocketChat is enabled
        if (process.env.ROCKETCHAT_ENABLED !== 'true') {
            return;
        }

        // Check if webhook URL is configured
        if (!process.env.ROCKETCHAT_WEBHOOK_URL) {
            return;
        }

        try {
            const rocketMessage = RocketChatNotifier.formatMessage(level, message, context, errorDetails);
            await RocketChatNotifier.sendToRocketChat(rocketMessage);
        } catch (error) {
            // Never throw on notification failure - just log
            console.error('Failed to send RocketChat alert:', error);
        }
    }

    /**
     * Format a message for RocketChat
     * @private
     */
    private static formatMessage(
        level: 'error' | 'info' | 'debug' | 'warn',
        message: string,
        context?: Record<string, any>,
        errorDetails?: ErrorDetails
    ): RocketChatMessage {
        const emoji = RocketChatNotifier.getEmojiForLevel(level, errorDetails?.severity);
        const environment = (process.env.NODE_ENV || 'development').toUpperCase();
        const serviceName = process.env.SERVICE_NAME || 'BreezyShip';
        const timestamp = new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        let text = `${emoji} **${level.toUpperCase()}`;

        if (errorDetails?.severity) {
            text += ` (${errorDetails.severity.toUpperCase()})`;
        }

        text += ` - ${environment}**\n`;
        text += `**Service:** ${serviceName}\n`;
        text += `**Time:** ${timestamp}`;

        const attachment: RocketChatAttachment = {
            color: RocketChatNotifier.getColorForLevel(level, errorDetails?.severity),
            title: errorDetails?.code || `${level.toUpperCase()} Alert`,
            text: message,
            fields: []
        };

        // Add error details if available
        if (errorDetails) {
            attachment.fields!.push({
                title: 'Error Type',
                value: errorDetails.type,
                short: true
            });

            attachment.fields!.push({
                title: 'Severity',
                value: errorDetails.severity,
                short: true
            });
        }

        // Add context if available
        if (context && Object.keys(context).length > 0) {
            const contextStr = Object.entries(context)
                .map(([key, value]) => `  ${key}: ${RocketChatNotifier.formatValue(value)}`)
                .join('\n');

            attachment.fields!.push({
                title: 'Context',
                value: '```\n' + contextStr + '\n```',
                short: false
            });
        }

        // Add stack trace if available
        if (errorDetails?.cause?.stack) {
            const stackLines = errorDetails.cause.stack.split('\n').slice(0, 5).join('\n');
            attachment.fields!.push({
                title: 'Stack Trace (top 5 lines)',
                value: '```\n' + stackLines + '\n```',
                short: false
            });
        }

        return {
            text,
            attachments: attachment.fields!.length > 0 ? [attachment] : undefined
        };
    }

    /**
     * Send message to RocketChat webhook
     * @private
     */
    private static async sendToRocketChat(message: RocketChatMessage): Promise<void> {
        const webhookUrl = process.env.ROCKETCHAT_WEBHOOK_URL;

        if (!webhookUrl) {
            throw new Error('ROCKETCHAT_WEBHOOK_URL is not configured');
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            throw new Error(`RocketChat webhook failed: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Get emoji for alert level
     * @private
     */
    private static getEmojiForLevel(level: string, severity?: string): string {
        if (severity === 'critical') return '🚨';

        switch (level) {
            case 'error': return '❌';
            case 'warn': return '⚠️';
            case 'info': return 'ℹ️';
            case 'debug': return '🔍';
            default: return '📝';
        }
    }

    /**
     * Get color for alert level
     * @private
     */
    private static getColorForLevel(level: string, severity?: string): string {
        if (severity === 'critical') return '#FF0000'; // Red
        if (severity === 'high') return '#FF6600'; // Orange-Red

        switch (level) {
            case 'error': return '#DC143C'; // Crimson
            case 'warn': return '#FFA500'; // Orange
            case 'info': return '#1E90FF'; // DodgerBlue
            case 'debug': return '#808080'; // Gray
            default: return '#000000'; // Black
        }
    }

    /**
     * Format a value for display
     * @private
     */
    private static formatValue(value: any): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return String(value);
            }
        }
        return String(value);
    }
}
