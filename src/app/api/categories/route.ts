import { NextResponse } from "next/server";
import { CATEGORIES, BANKS } from "@/lib/constants";

// Categories and banks are now static enums, not stored in the database
export async function GET() {
  return NextResponse.json({
    categories: Object.entries(CATEGORIES).map(([key, val]) => ({ key, ...val })),
    banks: Object.entries(BANKS).map(([key, val]) => ({ key, ...val })),
  });
}
