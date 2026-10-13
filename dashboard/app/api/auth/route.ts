import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  generateTokenForSecret,
  isRequestAuthenticated,
  isValidSecret,
} from "@/lib/auth";

export async function GET(request: Request) {
  const authenticated = isRequestAuthenticated(request.headers);
  return NextResponse.json({ authenticated });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret } = body;

    if (!isValidSecret(secret)) {
      return NextResponse.json({ error: "Invalid secret key" }, { status: 401 });
    }

    const token = generateTokenForSecret(secret);
    const response = NextResponse.json({ success: true, message: "Authenticated" });

    // 30 days cookie
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
