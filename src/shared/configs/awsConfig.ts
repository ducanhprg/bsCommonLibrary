import dotenv from 'dotenv'
dotenv.config()

export default {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.AWS_S3_BUCKET || '',
    s3Enabled: process.env.AWS_S3_ENABLED || false,
    s3: {
        maxRetries: Number(process.env.AWS_S3_MAX_RETRIES) || 3,
        timeout: Number(process.env.AWS_S3_TIMEOUT) || 5000,
        connectTimeout: Number(process.env.AWS_S3_CONNECT_TIMEOUT) || 5000,
        maxSockets: Number(process.env.AWS_S3_MAX_SOCKETS) || 10,
        maxIdleTime: Number(process.env.AWS_S3_MAX_IDLE_TIME) || 300000, // 5 minutes in milliseconds
    }
}
