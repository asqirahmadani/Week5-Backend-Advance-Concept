export const sanitizeUser = (user: any) => {
   if (!user) return null;
   const { password, ...safeUser } = user;
   return safeUser;
};