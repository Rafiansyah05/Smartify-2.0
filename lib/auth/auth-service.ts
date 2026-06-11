import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../supabase/client";
import { supabaseServer } from "../supabase/server";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function initiateRegistration(
  email: string,
  password: string,
  nama: string,
) {
  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      throw new Error("Email sudah terdaftar");
    }

    await supabaseServer
      .from("temporary_registrations")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const { data: existingTemp } = await supabaseServer
      .from("temporary_registrations")
      .select("*")
      .eq("email", email)
      .single();

    if (existingTemp) {
      await supabaseServer
        .from("temporary_registrations")
        .delete()
        .eq("email", email);
    }

    await supabaseServer
      .from("email_verifications")
      .delete()
      .eq("email", email);

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const passwordHash = await bcrypt.hash(password, 10);

    const tempExpiresAt = new Date();
    tempExpiresAt.setMinutes(tempExpiresAt.getMinutes() + 15);

    const { error: tempError } = await supabaseServer
      .from("temporary_registrations")
      .insert({
        email,
        password_hash: passwordHash,
        nama,
        expires_at: tempExpiresAt.toISOString(),
      });

    if (tempError) {
      console.error("Temporary registration error:", tempError);
      throw new Error("Gagal menyimpan data sementara: " + tempError.message);
    }

    const { error: verifError } = await supabaseServer
      .from("email_verifications")
      .insert({
        email,
        code: verificationCode,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      });

    if (verifError) {
      console.error("Email verification error:", verifError);
      throw new Error("Gagal menyimpan data verifikasi: " + verifError.message);
    }

    return { verificationCode, expiresAt };
  } catch (error: any) {
    console.error("Initiate registration error:", error);
    throw error;
  }
}

// Verify Email and Create User
export async function verifyAndCreateUser(code: string, email?: string) {
  try {
    let verificationQuery = supabaseServer
      .from("email_verifications")
      .select("*")
      .eq("code", code)
      .eq("is_used", false);
    if (email) {
      verificationQuery = verificationQuery.eq("email", email);
    }

    const { data: verificationRows, error: verifError } =
      await verificationQuery
        .order("created_at", { ascending: false })
        .limit(2);

    if (verifError || !verificationRows || verificationRows.length === 0) {
      throw new Error("Kode verifikasi tidak valid");
    }

    if (!email && verificationRows.length > 1) {
      throw new Error(
        "Ditemukan lebih dari satu data untuk kode ini. Silakan ulangi kirim kode verifikasi.",
      );
    }

    const verification = verificationRows[0];
    const verifiedEmail = verification.email;

    const now = new Date();
    let verifExpiresStr = verification.expires_at;
    if (
      typeof verifExpiresStr === "string" &&
      !verifExpiresStr.endsWith("Z") &&
      !verifExpiresStr.includes("+")
    ) {
      verifExpiresStr += "Z";
    }
    const expiresAt = new Date(verifExpiresStr);

    if (now > expiresAt) {
      throw new Error("Kode verifikasi sudah kadaluarsa");
    }

    const { data: tempData, error: tempError } = await supabaseServer
      .from("temporary_registrations")
      .select("*")
      .eq("email", verifiedEmail)
      .single();

    if (tempError || !tempData) {
      throw new Error(
        "Data registrasi tidak ditemukan. Silakan registrasi ulang.",
      );
    }

    let tempExpiresStr = tempData.expires_at;
    if (
      typeof tempExpiresStr === "string" &&
      !tempExpiresStr.endsWith("Z") &&
      !tempExpiresStr.includes("+")
    ) {
      tempExpiresStr += "Z";
    }
    if (new Date(tempExpiresStr) < now) {
      throw new Error(
        "Data registrasi sudah kadaluarsa. Silakan registrasi ulang.",
      );
    }

    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        email: verifiedEmail,
        password_hash: tempData.password_hash,
        nama: tempData.nama,
        role: "guru",
      })
      .select()
      .single();

    if (userError) {
      console.error("User creation error:", userError);
      throw new Error("Gagal membuat akun: " + userError.message);
    }

    await supabaseServer
      .from("email_verifications")
      .update({ is_used: true })
      .eq("id", verification.id);

    await supabaseServer
      .from("temporary_registrations")
      .delete()
      .eq("email", verifiedEmail);

    return { user: newUser };
  } catch (error: any) {
    console.error("Verify and create user error:", error);
    throw error;
  }
}

// Login
export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean = false,
) {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      throw new Error("Email atau password salah");
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error("Email atau password salah");
    }

    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: rememberMe ? "30d" : "1d" },
    );

    await supabase.from("user_sessions").delete().eq("user_id", user.user_id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 1));

    await supabase.from("user_sessions").insert({
      user_id: user.user_id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    return {
      user: {
        user_id: user.user_id,
        email: user.email,
        nama: user.nama,
        role: user.role,
        avatar_url: user.avatar_url,
      },
      token,
    };
  } catch (error: any) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function getUserFromToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };

    const { data: user } = await supabase
      .from("users")
      .select(
        "user_id, email, nama, role, avatar_url, subscription_status, expired_at",
      )
      .eq("user_id", decoded.userId)
      .single();

    return user;
  } catch {
    return null;
  }
}

// Logout
export async function logoutUser(token: string) {
  await supabase.from("user_sessions").delete().eq("token", token);
}

function hashPasswordResetToken(plainToken: string): string {
  return createHash("sha256").update(plainToken, "utf8").digest("hex");
}

function generatePasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

function parseSupabaseTimestamp(iso: string): Date {
  let s = iso;
  if (typeof s === "string" && !s.endsWith("Z") && !s.includes("+")) {
    s += "Z";
  }
  return new Date(s);
}

export async function createPasswordResetToken(
  email: string,
): Promise<{ plainToken: string; nama: string } | null> {
  const trimmed = email.trim();
  const { data: user, error } = await supabaseServer
    .from("users")
    .select("user_id, nama")
    .eq("email", trimmed)
    .maybeSingle();

  if (error || !user) {
    return null;
  }

  const plainToken = generatePasswordResetToken();
  const token_hash = hashPasswordResetToken(plainToken);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await supabaseServer
    .from("password_reset_tokens")
    .delete()
    .eq("user_id", user.user_id);

  const { error: insertError } = await supabaseServer
    .from("password_reset_tokens")
    .insert({
      user_id: user.user_id,
      token_hash,
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    console.error("password_reset_tokens insert:", insertError);
    throw new Error("Gagal membuat tautan reset password");
  }

  return { plainToken, nama: user.nama };
}

export async function resetPasswordWithToken(
  plainToken: string,
  password: string,
): Promise<void> {
  if (!plainToken || plainToken.length < 32) {
    throw new Error("Tautan tidak valid atau sudah kadaluarsa");
  }

  const token_hash = hashPasswordResetToken(plainToken.trim());

  const { data: row, error } = await supabaseServer
    .from("password_reset_tokens")
    .select("id, user_id, expires_at")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !row) {
    throw new Error("Tautan tidak valid atau sudah kadaluarsa");
  }

  const expiresAt = parseSupabaseTimestamp(row.expires_at as string);
  if (new Date() > expiresAt) {
    await supabaseServer
      .from("password_reset_tokens")
      .delete()
      .eq("id", row.id);
    throw new Error("Tautan tidak valid atau sudah kadaluarsa");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { error: updateUserError } = await supabaseServer
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("user_id", row.user_id);

  if (updateUserError) {
    console.error("reset password user update:", updateUserError);
    throw new Error("Gagal memperbarui password");
  }

  await supabaseServer
    .from("password_reset_tokens")
    .delete()
    .eq("user_id", row.user_id);
  await supabaseServer
    .from("user_sessions")
    .delete()
    .eq("user_id", row.user_id);
}
