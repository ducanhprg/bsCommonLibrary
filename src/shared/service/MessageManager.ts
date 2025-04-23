import { MessageCode, Messages, MessageType } from '../constants/messages';

type MessageCodeType = keyof typeof MessageCode;
type MessageTypeType = keyof typeof MessageType;

interface MessageOptions {
    details?: Record<string, any>;
    replace?: Record<string, any>;
}

interface Message {
    type: MessageTypeType;
    message: string;
}

export class MessageManager {
    static getMessage(code: MessageCodeType, options: MessageOptions = {}): string {
        const message = Messages[MessageCode[code]] as unknown as Message;
        if (!message) {
            return 'Unknown message';
        }

        let formattedMessage = message.message;

        // Replace placeholders in the message
        if (options.replace) {
            Object.entries(options.replace).forEach(([key, value]) => {
                formattedMessage = formattedMessage.replace(`{${key}}`, value);
            });
        }

        return formattedMessage;
    }

    static getMessageType(code: MessageCodeType): MessageTypeType {
        const message = Messages[MessageCode[code]] as unknown as Message;
        return message?.type || MessageType.ERROR;
    }

    static formatResponse<T>(
        code: MessageCodeType,
        data?: T,
        options: MessageOptions = {}
    ): {
        status: boolean;
        message: string;
        data?: T;
        error?: {
            code: string;
            details?: Record<string, any>;
        };
    } {
        const type = this.getMessageType(code);
        const message = this.getMessage(code, options);

        if (type === 'ERROR' as MessageTypeType) {
            return {
                status: false,
                message,
                error: {
                    code: MessageCode[code],
                    details: options.details
                }
            };
        }

        return {
            status: true,
            message,
            data
        };
    }

    static formatError(
        code: MessageCodeType,
        options: MessageOptions = {}
    ): {
        status: false;
        message: string;
        error: {
            code: string;
            details?: Record<string, any>;
        };
    } {
        const response = this.formatResponse(code, undefined, options);
        return {
            status: false,
            message: response.message,
            error: response.error!
        };
    }

    static formatSuccess<T>(
        code: MessageCodeType,
        data: T,
        options: MessageOptions = {}
    ): {
        status: true;
        message: string;
        data: T;
    } {
        const response = this.formatResponse(code, data, options);
        return {
            status: true,
            message: response.message,
            data: response.data!
        };
    }
} 