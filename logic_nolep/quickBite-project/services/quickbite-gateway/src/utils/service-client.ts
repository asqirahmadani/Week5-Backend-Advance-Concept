import { config } from "@/config/env";
import { logger } from "@/middleware/logger";
import type { ServiceResponse } from "@/types";

export class ServiceClient {
   private static async makeRequest(
      url: string,
      options: RequestInit = {},
      userHeaders?: Record<string, string>,
      timeout: number = config.orchestration.timeoutMs
   ): Promise<Response> {
      const headers = {
         'Content-Type': 'application/json',
         ...options.headers,
         ...userHeaders
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
         const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
         });

         clearTimeout(timeoutId);
         return response;
      } catch (error) {
         clearTimeout(timeoutId);
         throw error;
      }
   }

   static async call<T = any>(
      service: keyof typeof config.services,
      endpoint: string,
      options: RequestInit = {},
      userContext?: {
         userId?: string;
         userRole: string;
         userEmail?: string;
         transactionId?: string;
      }
   ): Promise<ServiceResponse<T>> {
      try {
         const serviceUrl = config.services[service];
         const url = `${serviceUrl}${endpoint}`;

         const userHeaders: Record<string, string> = {};
         if (userContext?.userId) userHeaders['X-User-ID'] = userContext.userId;
         if (userContext?.userRole) userHeaders['X-User-Role'] = userContext.userRole;
         if (userContext?.userEmail) userHeaders['X-User-Email'] = userContext.userEmail;
         if (userContext?.transactionId) userHeaders['X-Transaction-ID'] = userContext.transactionId;

         logger.info({
            service,
            endpoint,
            method: options.method || 'GET',
            transactionId: userContext?.transactionId
         }, 'Calling downstream service');

         const response = await this.makeRequest(url, options, userHeaders);
         const data: any = await response.json();

         if (!response.ok) {
            logger.error({
               service,
               endpoint,
               status: response.status,
               error: data.error || data.message,
               transactionId: userContext?.transactionId
            }, 'Downstream service error');

            return {
               success: false,
               error: data.error || data.message || `HTTP ${response.status}`,
               ...data
            };
         }

         logger.info({
            service,
            endpoint,
            status: response.status,
            transactionId: userContext?.transactionId
         }, 'Downstream service success');

         return {
            success: true,
            data,
            ...data
         };
      } catch (error: any) {
         logger.error({
            service,
            endpoint,
            error: error.message,
            transactionId: userContext?.transactionId
         }, 'Service communication failed');

         return {
            success: false,
            error: error.message || 'Service communication failed'
         };
      }
   }

   static async callWithRetry<T = any>(
      service: keyof typeof config.services,
      endpoint: string,
      options: RequestInit = {},
      userContext?: {
         userId?: string;
         userRole: string;
         userEmail?: string;
         transactionId?: string;
      },
      maxRetries: number = config.orchestration.maxRetryAttempts
   ): Promise<ServiceResponse<T>> {
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
         const result = await this.call<T>(service, endpoint, options, userContext);

         if (result.success) {
            return result;
         }

         lastError = result;

         if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
            logger.info({
               service,
               endpoint,
               attempt,
               maxRetries,
               delayMs: delay,
               transactionId: userContext?.transactionId
            }, 'Retrying service call');

            await new Promise(resolve => setTimeout(resolve, delay));
         }
      }

      return lastError!;
   }
}