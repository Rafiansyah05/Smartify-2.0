import { NextRequest, NextResponse } from "next/server";
import { initiateRegistration } from "@/lib/auth/auth-service";
import { sendVerificationEmail } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    const { email, password, nama } = await request.json();

    if (!email || !password || !nama) {
      return NextResponse.json(
        { error: "Semua field harus diisi" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid" },
        { status: 400 },
      );
    }

    const { verificationCode, expiresAt } = await initiateRegistration(
      email,
      password,
      nama,
    );

    await sendVerificationEmail(email, verificationCode, nama);

    return NextResponse.json({
      success: true,
      message:
        "Kode verifikasi telah dikirim ke email Anda. Silakan cek inbox atau folder spam.",
      email: email,
      expiresIn: 15,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
