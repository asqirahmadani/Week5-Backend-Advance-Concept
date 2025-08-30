export interface JWTPayload {
   sub: string
   email: string
   role: string
   iat: number
   exp: number
}

export interface AuthUser {
   id: string
   email: string
   role: string
   full_name: string
}