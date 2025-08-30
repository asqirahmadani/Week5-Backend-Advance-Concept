import { config } from "@/config/env";
import { logger } from "@/middleware/logger";
import { ServiceClient } from "./service-client";
import type { OrchestrationStep, OrchestrationContext } from "@/types";

export class CompensationManager {
   static async executeCompensation(
      context: OrchestrationContext,
      failedStep: string
   ): Promise<void> {
      if (!config.orchestration.compensationEnabled) {
         logger.info({
            transactionId: context.transactionId,
            failedStep
         }, 'Compensation disabled, skipping rollback');
         return;
      }

      logger.info({
         transactionId: context.transactionId,
         failedStep,
         completedSteps: context.completedSteps,
         orchestrationData: context.orchestrationData
      }, 'Starting compensation process');

      // Execute compensation in reverse order
      const stepsToCompensate = [...context.completedSteps].reverse();

      for (const stepName of stepsToCompensate) {
         const step = context.steps.find(s => s.stepName === stepName);

         if (step?.compensationEndpoint) {
            if (!step?.compensationEndpoint) {
               logger.debug({
                  transactionId: context.transactionId,
                  stepName
               }, 'No compensation endpoint defined for step, skipping');
               continue;
            }

            try {
               logger.info({
                  transactionId: context.transactionId,
                  stepName: step.stepName,
                  compensationEndpoint: step.compensationEndpoint
               }, 'Executing compensation step');

               const processedEndpoint = this.replaceTemplatePlaceholders(
                  step.compensationEndpoint,
                  context
               );

               let processedPayload = step.compensationPayload;
               if (processedPayload) {
                  processedPayload = this.replaceObjectPlaceholders(
                     processedPayload,
                     context
                  );
               }

               logger.info({
                  transactionId: context.transactionId,
                  stepName,
                  originalEndpoint: step.compensationEndpoint,
                  processedEndpoint,
                  originalPayload: step.compensationPayload,
                  processedPayload,
                  orchestrationData: context.orchestrationData
               }, 'Compensation execution details');

               const result = await ServiceClient.call(
                  step.service as any,
                  processedEndpoint,
                  {
                     method: step.compensationMethod || 'PATCH',
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
                  context.rollbackSteps.push(stepName);
                  logger.info({
                     transactionId: context.transactionId,
                     stepName: step.stepName
                  }, 'Compensation step executed successfully');
               } else {
                  logger.error({
                     transactionId: context.transactionId,
                     stepName: step.stepName,
                     error: result.error
                  }, 'Compensation step failed');
               }
            } catch (error: any) {
               logger.error({
                  transactionId: context.transactionId,
                  stepName: step.stepName,
                  error: error.message
               }, 'Compensation step execution error');
            }
         }
      }
      logger.info({
         transactionId: context.transactionId,
         totalSteps: stepsToCompensate.length,
         successfulCompensations: context.rollbackSteps.length
      }, 'Compensation process completed');
   }

   private static replaceTemplatePlaceholders(
      template: string,
      context: OrchestrationContext
   ): string {
      let result = template;

      const allData = {
         ...context.orchestrationData,
         userId: context.userId,
         userEmail: context.userEmail,
         transactionId: context.transactionId
      };

      for (const [key, value] of Object.entries(allData)) {
         const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
         if (result.includes(`{{${key}}}`)) {
            result = result.replace(placeholder, String(value));
         }
      }

      return result;
   }

   private static replaceObjectPlaceholders(
      obj: any,
      context: OrchestrationContext
   ): any {
      if (typeof obj === 'string') {
         return this.replaceTemplatePlaceholders(obj, context);
      }

      if (Array.isArray(obj)) {
         return obj.map(item => this.replaceObjectPlaceholders(item, context));
      }

      if (obj && typeof obj === 'object') {
         const result: any = {};
         for (const [key, value] of Object.entries(obj)) {
            result[key] = this.replaceObjectPlaceholders(value, context);
         }
         return result;
      }

      return obj;
   }
}