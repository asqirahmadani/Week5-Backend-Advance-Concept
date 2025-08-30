import pino from 'pino';
import { config } from '@/config/env';

export const logger = pino({
   level: config.logging.level,
   transport: config.nodeEnv === 'development' ? {
      target: 'pino-pretty',
      options: {
         colorize: true,
         translateTime: 'SYS:dd/mm/yyyy HH:MM:ss',
         ignore: 'pid,hostname'
      }
   } : undefined
});

export const loggerMiddleware = () => {
   return {
      onRequest({ request }: any) {
         logger.info({
            method: request.method,
            url: request.url,
            headers: request.headers
         }, 'Incoming request');
      },

      onResponse({ request, response }: any) {
         logger.info({
            method: request.method,
            url: request.url,
            status: response.status
         }, 'Request completed');
      },

      onError({ request, error }: any) {
         logger.error({
            method: request.method,
            url: request.url,
            error: error.message
         }, 'Request error');
      }
   }
}