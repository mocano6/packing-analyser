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
    const result = await next(params);
    return result;
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} 