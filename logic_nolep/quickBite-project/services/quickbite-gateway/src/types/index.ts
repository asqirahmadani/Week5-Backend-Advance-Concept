export interface User {
   id: string;
   email: string;
   role: 'customer' | 'driver' | 'restaurant_owner' | 'admin';
   fullName: string;
   phone: string;
   status: 'active' | 'suspended' | 'inactive'
}

export interface AuthenticatedRequest {
   user?: User;
   userId?: string;
   userRole?: string;
   userEmail?: string;
}

export interface ServiceResponse<T = any> {
   success: boolean;
   data?: T;
   error?: string;
   message?: string;
}

export interface OrchestrationStep {
   stepName: string;
   service: string;
   endpoint: string;
   method: string;
   payload?: any;
   compensationEndpoint?: string;
   compensationMethod?: string;
   compensationPayload?: any;
}

export interface OrchestrationContext {
   transactionId: string;
   userId: string;
   userEmail: string;
   userRole: string;
   steps: OrchestrationStep[];
   completedSteps: string[];
   rollbackSteps: string[];
   orchestrationData: Record<string, any>;
}

export interface OrderOrchestrationData {
   orderId?: string;
   paymentIntentId?: string;
   paymentLink?: string;
   sessionId?: string;
   deliveryId?: string;
   notificationIds?: string[];
}

export interface ReviewOrchestrationData {
   reviewId?: string;
   restaurantId?: string
   updatedRating?: number;
   totalReviews?: number;
   previousRating?: number
}

export interface APIError {
   success: false;
   error: string;
   statusCode?: number;
   transactionId?: string;
}

export type UserRole = 'customer' | 'driver' | 'restaurant_owner' | 'admin';