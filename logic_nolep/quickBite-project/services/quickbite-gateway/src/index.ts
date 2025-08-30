import { Elysia } from "elysia";
import { config } from "./config/env";
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';
import { corsMiddleware } from "./middleware/cors";
import { loggerMiddleware } from "./middleware/logger";
import { errorHandler } from "./middleware/error-handler";

// import route modules
import { authRoutes } from "./routes/auth";
import { orderRoutes } from "./routes/orders";
import { reviewRoutes } from "./routes/reviews";

const app = new Elysia()
  .use(corsMiddleware)
  // .use(loggerMiddleware())
  // .use(errorHandler)
  .use(staticPlugin())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'QuickBite API Gateway - Orchestrator',
          version: '1.0.0',
          description: `
# QuickBite Food Delivery Platform - API Gateway

## Architecture Overview
This API Gateway implements the **Orchestrator Pattern** for managing complex business processes across multiple microservices.

## Key Features
- **Business Process Orchestration**: Complex workflows spanning multiple services
- **Automatic Compensation**: Built-in rollback mechanisms for failed transactions
- **Centralized Authentication**: JWT-based auth with role-based access control
- **Transaction Tracking**: Every orchestrated process has a unique transaction ID
- **Comprehensive Logging**: Detailed request/response logging with transaction correlation

## Orchestrated Endpoints
These endpoints coordinate multiple microservices to complete business processes:

### 🔄 Order Management
- **POST /api/orders** - Create order → Generate payment → Send notification
- **POST /api/orders/{id}/accept** - Accept delivery → Assign driver → Notify parties
- **PATCH /api/orders/{id}/cancel** - Cancel order → Process refund → Send notification

### ⭐ Review Management  
- **POST /api/reviews** - Create review → Update restaurant stats → Update driver stats

## Direct Pass-through Endpoints
These endpoints directly proxy requests to downstream services without orchestration.

## Error Handling & Compensation
Failed orchestrated processes automatically trigger compensation actions to maintain data consistency.

## Service Status
- User Service: ${config.services.user}
- Restaurant Service: ${config.services.restaurant}  
- Order Service: ${config.services.order}
- Payment Service: ${config.services.payment}
- Delivery Service: ${config.services.delivery}
- Review Service: ${config.services.review}
- Notification Service: ${config.services.notification}
          `
        },
        tags: [
          { name: 'Authentication', description: 'User authentication and authorization' },
          { name: 'Orders - Orchestrated', description: 'Multi-service order management workflows' },
          { name: 'Orders - Direct', description: 'Direct pass-through to order service' },
          { name: 'Reviews - Orchestrated', description: 'Multi-service review workflows' },
          { name: 'Reviews - Direct', description: 'Direct pass-through to review service' }
        ]
      },
      path: '/docs'
    })
  )

  // Health check endpoint
  .get('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: config.services,
    orchestration: {
      compensationEnabled: config.orchestration.compensationEnabled,
      maxRetryAttempts: config.orchestration.maxRetryAttempts,
      timeoutMs: config.orchestration.timeoutMs
    }
  }), {
    detail: {
      tags: ['System'],
      summary: 'Health Check',
      description: 'Check API Gateway and downstream services status'
    }
  })

  // Register route modules
  .use(authRoutes)
  .use(orderRoutes)
  .use(reviewRoutes)
  .listen(config.port || 3000);

console.log(`🚀 QuickBite API Gateway - Orchestrator running at http://localhost:${config.port}`);
console.log(`📚 API Documentation available at http://localhost:${config.port}/docs`);
console.log(`🏥 Health Check available at http://localhost:${config.port}/health`);
console.log(`🔧 Compensation ${config.orchestration.compensationEnabled ? 'ENABLED' : 'DISABLED'}`);

export type App = typeof app;