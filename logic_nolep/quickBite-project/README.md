```markdown
# QuickBite API Gateway - Orchestrator Pattern

A comprehensive API Gateway implementing business process orchestration for the QuickBite food delivery platform.

## 🏗️ Architecture

This gateway implements the **Orchestrator Pattern** where complex business workflows are managed centrally, coordinating calls to multiple microservices to complete end-to-end processes.

### Key Orchestrated Flows

#### 1. Order Creation Flow
```
POST /api/orders
├── Step 1: Create order (PENDING_PAYMENT) → order-service
├── Step 2: Generate payment intent → payment-service  
├── Step 3: Send payment notification → notification-service
└── Compensation: Cancel order if any step fails
```

#### 2. Driver Assignment Flow  
```
POST /api/orders/{id}/accept
├── Step 1: Update order status → order-service
├── Step 2: Create delivery assignment → delivery-service
├── Step 3: Notify customer → notification-service
├── Step 4: Notify restaurant → notification-service
└── Compensation: Reset order status if any step fails
```

#### 3. Review Submission Flow
```
POST /api/reviews  
├── Step 1: Create review → review-service
├── Step 2: Update restaurant rating → restaurant-service
├── Step 3: Update driver rating → user-service
└── Compensation: Delete review if rating updates fail
```

## 🚀 Quick Start

### Prerequisites
- Bun runtime installed
- All 7 microservices running on their respective ports
- PostgreSQL, Redis, and RabbitMQ running

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd quickbite-gateway

# Install dependencies  
bun install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start the gateway in development mode
bun run dev

# Or start in production mode
bun run start
```

### Environment Configuration
Update `.env` file with your service URLs and configuration:

```env
# Service URLs
USER_SERVICE_URL=http://localhost:3001
RESTAURANT_SERVICE_URL=http://localhost:3002
ORDER_SERVICE_URL=http://localhost:3003
PAYMENT_SERVICE_URL=http://localhost:3004
DELIVERY_SERVICE_URL=http://localhost:3005
REVIEW_SERVICE_URL=http://localhost:3006
NOTIFICATION_SERVICE_URL=http://localhost:3007

# Orchestration Settings
ORCHESTRATION_TIMEOUT_MS=30000
MAX_RETRY_ATTEMPTS=3
COMPENSATION_ENABLED=true
```

## 📚 API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

## 🔄 Orchestration Features

### Transaction Management
- Every orchestrated process gets a unique transaction ID
- All steps are logged with transaction correlation
- Failed transactions trigger automatic compensation

### Compensation Pattern
- Automatic rollback of completed steps when orchestration fails
- Configurable compensation endpoints for each step
- Maintains data consistency across services

### Retry Logic  
- Configurable retry attempts with exponential backoff
- Service-level timeout handling
- Graceful degradation on persistent failures

### Monitoring & Logging
- Structured logging with Pino
- Request/response correlation
- Transaction-level tracing
- Performance metrics

## 🏃‍♂️ Usage Examples

### Create Order (Orchestrated)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "restaurantId": "uuid-here",
    "items": [
      {"menuItemId": "uuid-here", "quantity": 2}
    ],
    "deliveryAddress": "123 Main St, City"
  }'
```

### Submit Review (Orchestrated)  
```bash
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": "uuid-here",
    "restaurantId": "uuid-here", 
    "restaurantRating": 5,
    "foodQuality": 4,
    "deliveryTime": 5,
    "restaurantComment": "Excellent food!"
  }'
```

## 🔧 Development

### Project Structure
```
services/
├── delivery-service/     # Business process delivery logic
├── notification-service/ # Business process notification logic
├── order-service/        # Business process order logic
├── payment-service/      # Business process payment logic
├── quickbite-gateway/    # Main Business process (Orchestration)
├── restaurant-service/   # Business process restaurant logic
├── review-service/       # Business process review logic
└── user-service/         # Business process user logic
```

### Adding New Orchestrated Endpoints

1. Create orchestrator in `services/quickbite-gateway/src/orchestrators`
2. Define steps with compensation logic
3. Add route handler in `src/routes/`
4. Update Swagger documentation

### Testing
```bash
# Run tests
bun test

```

## 📊 Monitoring

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": { ... },
  "orchestration": {
    "compensationEnabled": true,
    "maxRetryAttempts": 3,
    "timeoutMs": 30000
  }
}
```

### Transaction Tracking
Every orchestrated request returns a `transactionId` for tracking across services and logs.

## 🚨 Error Handling

- **4xx errors**: Client errors (validation, authentication)
- **5xx errors**: Server errors (service failures, timeouts)
- **Compensation**: Automatic rollback on orchestration failures
- **Idempotency**: Safe retry mechanisms for critical operations

## 📈 Performance

- Connection pooling for downstream services
- Configurable timeouts and retry policies  
- Async/non-blocking architecture
- Efficient error propagation

## 🔐 Security

- JWT-based authentication
- Role-based access control (RBAC)
- Request validation with TypeScript schemas
- CORS configuration for web clients
- Secure headers and logging practices

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details
```