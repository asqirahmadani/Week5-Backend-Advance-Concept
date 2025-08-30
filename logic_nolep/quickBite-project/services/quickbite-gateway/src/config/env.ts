export const config = {
   port: parseInt(process.env.PORT || '3000'),
   nodeEnv: process.env.NODE_ENV || 'development',

   jwt: {
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
   },

   services: {
      user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      restaurant: process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3002',
      order: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
      payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
      delivery: process.env.DELIVERY_SERVICE_URL || 'http://localhost:3005',
      review: process.env.REVIEW_SERVICE_URL || 'http://localhost:3006',
      notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007'
   },

   orchestration: {
      timeoutMs: parseInt(process.env.ORCHESTRATION_TIMEOUT_MS || '30000'),
      maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
      compensationEnabled: process.env.COMPENSATION_ENABLED === 'true'
   },

   rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000')
   },

   logging: {
      level: process.env.LOG_LEVEL || 'info'
   }
}