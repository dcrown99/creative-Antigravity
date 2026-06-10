import '@testing-library/jest-dom'

// Mock next/cache functions
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
    revalidateTag: jest.fn(),
    unstable_cache: (fn) => fn,
}))

// Mock Prisma Client
jest.mock('@/lib/prisma', () => ({
    prisma: {
        asset: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        transaction: {
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn(),
            groupBy: jest.fn(),
        },
        dividend: {
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        categoryRule: {
            findMany: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
        analysisLog: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
        history: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
    },
}))
