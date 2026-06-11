import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth/auth-service";

export async function POST(request: NextRequest) {
  try {
    const { token, password, confirmPassword } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Tautan reset tidak valid" },
        { status: 400 },
      );
    }

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { error: "Password dan konfirmasi harus diisi" },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Password tidak cocok" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 },
      );
    }

    await resetPasswordWithToken(token, password);

    return NextResponse.json({
      success: true,
      message:
        "Password berhasil diubah. Silakan masuk dengan password baru Anda.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal mengatur ulang password" },
      { status: 400 },
    );
  }
}
