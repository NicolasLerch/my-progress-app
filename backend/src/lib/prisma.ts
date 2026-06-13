import prismaClientPkg from "@prisma/client"
import type { PrismaClient as PrismaClientType } from "@prisma/client"

const { PrismaClient } = prismaClientPkg

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClientType
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
