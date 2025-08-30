import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/middleware/logger';
import { ServiceClient } from '@/utils/service-client';
import { CompensationManager } from '@/utils/compensation';
import type { OrchestrationStep, OrchestrationContext } from '@/types';

export abstract class BaseOrchestrator {
   protected createContext(
      userId: string,
      userEmail: string,
      userRole: string,
      steps: OrchestrationStep[]
   ): OrchestrationContext {
      return {
         transactionId: uuidv4(),
         userId,
         userEmail,
         userRole,
         steps,
         completedSteps: [],
         rollbackSteps: [],
         orchestrationData: {}
      };
   }

   private replaceTemplatePlaceholders(
      template: string,
      context: OrchestrationContext,
      additionalData: any = {}
   ): string {
      let result = template;

      const allData = {
         ...context.orchestrationData,
         ...additionalData,
         userId: context.userId,
         userEmail: context.userEmail,
         userRole: context.userRole,
         transactionId: context.transactionId
      };

      logger.debug({
         transactionId: context.transactionId,
         template: template,
         availableData: Object.keys(allData),
         dataValues: allData
      }, 'Replacing template placeholders');

      // replace placeholder {{key}} with real value
      for (const [key, value] of Object.entries(allData)) {
         const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
         if (result.includes(`{{${key}}}`)) {
            result = result.replace(placeholder, String(value));
            logger.debug({
               transactionId: context.transactionId,
               key,
               value,
               before: template,
               after: result
            }, `Replaced placeholder {{${key}}}`);
         }
      }

      return result;
   }

   private replaceObjectPlaceholders(
      obj: any,
      context: OrchestrationContext,
      additionalData: any = {}
   ): any {
      if (typeof obj === 'string') {
         return this.replaceTemplatePlaceholders(obj, context, additionalData);
      }

      if (Array.isArray(obj)) {
         return obj.map(item => this.replaceObjectPlaceholders(item, context, additionalData));
      }

      if (obj && typeof obj === 'object') {
         const result: any = {};
         for (const [key, value] of Object.entries(obj)) {
            result[key] = this.replaceObjectPlaceholders(value, context, additionalData);
         }
         return result;
      }

      return obj;
   }

   protected async executeStep(
      step: OrchestrationStep,
      context: OrchestrationContext,
      additionalData: any = {}
   ): Promise<any> {
      logger.info({
         transactionId: context.transactionId,
         stepName: step.stepName,
         service: step.service,
         endpoint: step.endpoint
      }, 'Executing orchestration step');

      try {
         const processedEndpoint = this.replaceTemplatePlaceholders(
            step.endpoint,
            context,
            additionalData
         );

         let processedPayload = step.payload;
         if (processedPayload) {
            processedPayload = this.replaceObjectPlaceholders(
               processedPayload,
               context,
               additionalData
            );
         }

         logger.info({
            transactionId: context.transactionId,
            stepName: step.stepName,
            originalEndpoint: step.endpoint,
            processedEndpoint,
            originalPayload: step.payload,
            processedPayload,
            availableData: {
               ...context.orchestrationData,
               ...additionalData
            }
         }, 'Step execution details');

         const result = await ServiceClient.callWithRetry(
            step.service as any,
            processedEndpoint,
            {
               method: step.method,
               body: processedPayload ? JSON.stringify(processedPayload) : undefined
            },
            {
               userId: context.userId,
               userRole: context.userRole,
               userEmail: context.userEmail,
               transactionId: context.transactionId
            }
         );

         if (result.success) {
            this.saveStepResult(step.stepName, result.data, context);
            context.completedSteps.push(step.stepName);
            logger.info({
               transactionId: context.transactionId,
               stepName: step.stepName,
               result: result.data,
               updatedOrchestrationData: context.orchestrationData
            }, 'Orchestration step completed successfully');
            return result.data;
         } else {
            logger.error({
               transactionId: context.transactionId,
               stepName: step.stepName,
               error: result.error
            }, 'Orchestration step failed');
            throw new Error(`Step ${step.stepName} failed: ${result.error}`);
         }
      } catch (error: any) {
         logger.error({
            transactionId: context.transactionId,
            stepName: step.stepName,
            error: error.message
         }, 'Orchestration step execution error');
         throw error;
      }
   }

   protected async handleOrchestrationFailure(
      context: OrchestrationContext,
      failedStep: string,
      error: Error
   ): Promise<void> {
      logger.error({
         transactionId: context.transactionId,
         failedStep,
         error: error.message,
         completedSteps: context.completedSteps,
         orchestrationData: context.orchestrationData
      }, 'Orchestration failed, initiating compensation');

      await CompensationManager.executeCompensation(context, failedStep);
   }

   private saveStepResult(stepName: string, data: any, context: OrchestrationContext): void {
      if (!context.orchestrationData) {
         context.orchestrationData = {};
      }

      switch (stepName) {
         case 'create_order':
            context.orchestrationData.orderId = data.id || data.order?.id;
            context.orchestrationData.totalAmount = data.totalAmount || data.order?.totalAmount;
            context.orchestrationData.customerEmail = data.customerEmail || data.order?.customerEmail;
            context.orchestrationData.customerName = data.customerName || data.order?.customerName;
            break;

         case 'create_payment':
            context.orchestrationData.sessionId = data.sessionId;
            context.orchestrationData.paymentLink = data.paymentUrl;
            context.orchestrationData.paymentIntentId = data.paymentIntentId;
            context.orchestrationData.paymentId = data.id;
            break;

         case 'assign_delivery':
            context.orchestrationData.deliveryId = data.deliveryId || data.id;
            context.orchestrationData.driverName = data.driverName;
            context.orchestrationData.estimatedArrival = data.estimatedArrival;
            break;

         case 'queue_notification':
         case 'send_notification':
            context.orchestrationData.notificationId = data.notificationId || data.id;
            break;

         default:
            // Untuk step custom, simpan semua data dengan prefix stepName
            Object.keys(data).forEach(key => {
               context.orchestrationData![`${stepName}_${key}`] = data[key];
            });

            // Juga simpan data langsung jika tidak conflict
            Object.keys(data).forEach(key => {
               if (!context.orchestrationData![key]) {
                  context.orchestrationData![key] = data[key];
               }
            });
      }

      logger.debug({
         transactionId: context.transactionId,
         stepName,
         savedData: context.orchestrationData
      }, 'Step result saved to orchestration data');
   }
}