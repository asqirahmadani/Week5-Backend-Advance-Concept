export interface ApiResponse<T = any> {
   success: boolean;
   data?: T;
   message?: string;
   error?: string;
   timestamp: string;
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
   return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
   };
}

export function errorResponse(error: string, data?: any): ApiResponse {
   return {
      success: false,
      error,
      data,
      timestamp: new Date().toISOString(),
   };
}