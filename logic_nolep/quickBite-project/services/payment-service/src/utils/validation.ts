import { t } from 'elysia';

export const UUIDSchema = t.String({
   format: 'uuid',
   error: 'Invalid UUID format'
});

export const AmountSchema = t.Number({
   minimum: 0.01,
   error: 'Amount must be greater than 0'
});

export const CurrencySchema = t.String({
   pattern: '^(USD|EUR|GBP|JPY)',
   error: 'Supported currencies: USD, EUR, GBP, JPY'
});

export const validateUUID = (value: string): boolean => {
   const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   return uuidRegex.test(value);
};

export const validateAmount = (amount: number): boolean => {
   return amount > 0 && Number.isFinite(amount);
};

export const validateCurrency = (currency: string): boolean => {
   const supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY'];
   return supportedCurrencies.includes(currency.toUpperCase());
};

export const sanitizeAmount = (amount: number): number => {
   return Math.round(amount * 100) / 100; // Round to 2 decimal places
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
   return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
   }).format(amount);
};