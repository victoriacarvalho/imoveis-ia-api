import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString === "undefined") {
    console.error("❌ ERRO: DATABASE_URL não encontrada. Verifique seu arquivo .env");
    process.exit(1);
}
const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false,
    },
});
const adapter = new PrismaPg(pool);
const globalForPrisma = global;
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
