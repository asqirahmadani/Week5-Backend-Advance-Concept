import { Elysia } from "elysia";
import jwt from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { bearer } from '@elysiajs/bearer';
import { swagger } from '@elysiajs/swagger';
import { adminRoutes } from "./routes/admin.route";
import { reviewRoutes } from "./routes/review.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = new Elysia()
  .use(cors({ credentials: true, origin: 'http://localhost' }))
  .use(bearer())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET! || '081bf92884614a5944007b1c92d44e38e61a101fb284588567894b1fb0068778',
      exp: '7d'
    })
  )
  .use(swagger({ path: '/docs' }))
  .use(reviewRoutes)
  .use(adminRoutes)
  .use(errorHandler)
  .listen(process.env.PORT_REVIEW || 3006);

console.log(`⭐ Review Service is running at http://localhost:3006`);