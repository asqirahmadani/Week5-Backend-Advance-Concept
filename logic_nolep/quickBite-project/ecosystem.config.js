const dotenv = require('dotenv');
dotenv.config();

module.exports = {
   apps: [
      {
         name: 'quickbite-gateway',
         script: './services/quickbite-gateway/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT: process.env.PORT,
            NODE_ENV: 'development',
            JWT_SECRET: process.env.JWT_SECRET,
            JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
            USER_SERVICE_URL: process.env.USER_SERVICE_URL,
            RESTAURANT_SERVICE_URL: process.env.RESTAURANT_SERVICE_URL,
            ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL,
            PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL,
            DELIVERY_SERVICE_URL: process.env.DELIVERY_SERVICE_URL,
            REVIEW_SERVICE_URL: process.env.REVIEW_SERVICE_URL,
            NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL,
            ORCHESTRATION_TIMEOUT_MS: process.env.ORCHESTRATION_TIMEOUT_MS,
            MAX_RETRY_ATTEMPTS: process.env.MAX_RETRY_ATTEMPTS,
            COMPENSATION_ENABLED: process.env.COMPENSATION_ENABLED,
            RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
            RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
            LOG_LEVEL: process.env.LOG_LEVEL
         }
      },
      {
         name: 'user-service',
         script: './services/user-service/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT_USER: process.env.PORT_USER,
            JWT_SECRET: process.env.JWT_SECRET,
            DATABASE_URL: process.env.DATABASE_URL,
            JWT_ACCESS_EXPIRATION_MINUTES: process.env.JWT_ACCESS_EXPIRATION_MINUTES,
            JWT_REFRESH_EXPIRATION_DAYS: process.env.JWT_REFRESH_EXPIRATION_DAYS,
            STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
            STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
            STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
         }
      },
      {
         name: 'restaurant-service',
         script: './services/restaurant-service/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT_RESTAURANT: process.env.PORT_RESTAURANT,
            JWT_SECRET: process.env.JWT_SECRET,
            DATABASE_URL: process.env.DATABASE_URL
         }
      },
      {
         name: 'order-service',
         script: './services/order-service/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT_ORDER: process.env.PORT_ORDER,
            JWT_SECRET: process.env.JWT_SECRET,
            DATABASE_URL: process.env.DATABASE_URL
         }
      },
      {
         name: 'payment-service',
         script: './services/payment-service/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT_PAYMENT: process.env.PORT_PAYMENT,
            JWT_SECRET: process.env.JWT_SECRET,
            DATABASE_URL: process.env.DATABASE_URL,
            STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
            STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
            ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL,
            NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL
         }
      },
      {
         name: 'delivery-service',
         script: './services/delivery-service/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT_DELIVERY: process.env.PORT_DELIVERY,
            JWT_SECRET: process.env.JWT_SECRET,
            DATABASE_URL: process.env.DATABASE_URL
         }
      },
      {
         name: 'review-service',
         script: './services/review-service/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT_REVIEW: process.env.PORT_REVIEW,
            JWT_SECRET: process.env.JWT_SECRET,
            DATABASE_URL: process.env.DATABASE_URL
         }
      },
      {
         name: 'notification-service',
         script: './services/notification-service/src/index.ts',
         watch: true,
         interpreter: 'bun',
         env: {
            PORT_NOTIFICATION: process.env.PORT_NOTIFICATION,
            JWT_SECRET: process.env.JWT_SECRET,
            DATABASE_URL: process.env.DATABASE_URL,
            SMTP_HOST: process.env.SMTP_HOST,
            SMTP_PORT: process.env.SMTP_PORT,
            SMTP_USER: process.env.SMTP_USER,
            SMTP_PASS: process.env.SMTP_PASS,
            SMTP_FROM: process.env.SMTP_FROM,
            CLOUDAMQP_URL: process.env.CLOUDAMQP_URL
         }
      },
   ]
}