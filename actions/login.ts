import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy custom-JWT login endpoint.
 * Authentication is handled exclusively by NextAuth.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "This login endpoint has been retired. Use NextAuth credentials sign-in." },
    { status: 410 }
  );
}
