import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Dodaj tryb debugowania zapytań
const logQueryParams = process.env.NODE_ENV === "development";

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: logQueryParams ? ["query", "error", "warn"] : ["error"],
});

// Dodajmy niestandardowe middleware do debugowania
if (logQueryParams) {
  prisma.$use(async (params, next) => {
    console.log(`[Prisma Debug] Operation: ${params.action} on ${params.model}`);
    
    if (params.action === 'findMany' && params.args?.select) {
      console.log('[Prisma Debug] Select:', JSON.stringify(params.args.select));
    }
    
    const result = await next(params);
    return result;
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} 