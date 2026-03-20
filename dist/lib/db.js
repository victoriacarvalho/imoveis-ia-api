import "dotenv/config"; // 🔴 ESSENCIAL para carregar o .env no script de seed
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";
// 1. Pegamos a string do .env
const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString === "undefined") {
    console.error("❌ ERRO: DATABASE_URL não encontrada. Verifique seu arquivo .env");
    process.exit(1);
}
// 2. Criamos o Pool do 'pg' com SSL (obrigatório para o Neon)
const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false, // Permite a conexão segura com o Neon
    },
});
// 3. Passamos o POOL para o adaptador (e não a string direto)
const adapter = new PrismaPg(pool);
const globalForPrisma = global;
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
