import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaPoolConfigLogged: boolean | undefined;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const poolMax = readPositiveInt(
  process.env.PG_POOL_MAX,
  process.env.NODE_ENV === "production" ? 1 : 5,
);

const connectionTimeoutMillis = readPositiveInt(process.env.PG_CONNECT_TIMEOUT_MS, 10_000);
const idleTimeoutMillis = readPositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30_000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  connectionTimeoutMillis,
  idleTimeoutMillis,
});

const adapter = new PrismaPg(pool);

export const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaPoolConfigLogged) {
    console.info("[prisma] pg pool config", {
      max: poolMax,
      connectionTimeoutMillis,
      idleTimeoutMillis,
    });
    global.prismaPoolConfigLogged = true;
  }
  global.prisma = prisma;
}
