import { cors } from '@elysiajs/cors';

export const corsMiddleware = cors({
   origin: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
   credentials: true
});