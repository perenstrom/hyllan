import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "healthy" });
  } catch (error) {
    logger.error({ error }, "health check failed: database unreachable");
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
