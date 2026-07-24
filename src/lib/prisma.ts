import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import path from "path"

// Resolve absolute path so the adapter always finds the DB regardless of CWD
const dbPath = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL
  : `file:${path.resolve(process.cwd(), "dev.db")}`

const adapter = new PrismaLibSql({ url: dbPath })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
