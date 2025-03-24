import { PrismaClient } from "@prisma/client";

// Deklaracja dla TypeScript aby rozpoznać globalną zmienną
declare global {
  var prisma: PrismaClient | undefined;
}

// Wykorzystanie singleton pattern aby uniknąć wielu instancji w trybie deweloperskim
export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
