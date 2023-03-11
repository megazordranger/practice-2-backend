import { PrismaClient } from '@prisma/client'

export interface Context {
  prisma: PrismaClient
}

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

export const createContext = async () => ({
  prisma: prisma,
})
