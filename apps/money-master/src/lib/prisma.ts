import { PrismaClient, Transaction as PrismaTransactionType, Asset as PrismaAssetType } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

// Export Prisma types for use in service files
export type PrismaTransaction = PrismaTransactionType;
export type PrismaAsset = PrismaAssetType;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
