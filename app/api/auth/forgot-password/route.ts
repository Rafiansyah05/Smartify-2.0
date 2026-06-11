import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth/auth-service";
import { sendPasswordResetEmail } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email harus diisi" }, { status: 400 });
    }

    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return NextResponse.json(
        { error: "Format email tidak valid" },
        { status: 400 },
      );
    }

    const origin = request.headers.get("origin") || new URL(request.url).origin;
    const tokenPayload = await createPasswordResetToken(trimmed);

    if (tokenPayload) {
      const resetUrl = `${origin}/auth/reset-password?token=${encodeURIComponent(tokenPayload.plainToken)}`;
      await sendPasswordResetEmail(trimmed, tokenPayload.nama, resetUrl);
    }

    return NextResponse.json({
      success: true,
      message:
        "Jika email terdaftar di Smartify, kami telah mengirimkan tautan untuk mengatur ulang password. Periksa kotak masuk atau folder spam, lalu ikuti petunjuk di email tersebut.",
    });
  } catch (error: any) {
    console.error("forgot-password:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan" },
      { status: 400 },
    );
  }
}
