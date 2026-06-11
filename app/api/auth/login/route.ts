import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/auth-service";

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password harus diisi" },
        { status: 400 },
      );
    }

    const { user, token } = await loginUser(email, password);

    const response = NextResponse.json({
      success: true,
      user,
      redirectTo: "/dashboard",
    });

    const maxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24;
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
