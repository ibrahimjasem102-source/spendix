import { validateAllSecrets } from "@/lib/env";
import { NextResponse } from "next/server";

// GET /api/health — lightweight liveness + secret-presence check.
// Does NOT expose secret values, only whether they are set.
export async function GET() {
  const { ok, missing } = validateAllSecrets();
  return NextResponse.json(
    { ok, missing: ok ? [] : missing },
    { status: ok ? 200 : 500 }
  );
}
