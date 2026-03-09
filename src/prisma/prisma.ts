import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ ERROR: DATABASE_URL is not defined in your .env file.");
    process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Providing explicit options to satisfy Prisma 7's "non-empty" requirement
const prisma = new PrismaClient({
    adapter,
    log: ["error", "warn"],
});

export default prisma;
