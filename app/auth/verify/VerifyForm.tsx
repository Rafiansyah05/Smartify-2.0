"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/footer/footer";

interface VerifyFormProps {
  emailParam: string;
}

export default function VerifyForm({ emailParam }: VerifyFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...(email ? { email } : {}) }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setSuccess(
        "Email berhasil diverifikasi! Mengarahkan ke halaman login...",
      );
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError("Masukkan email terlebih dahulu");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess("Kode verifikasi baru telah dikirim ke email Anda");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-card rounded-2xl shadow-sm p-8 md:p-10">
            <div className="flex flex-col items-center mb-6">
              <Image
                src="/images/logo_smartify.png"
                alt="Logo"
                width={120}
                height={40}
                priority
              />
            </div>

            <div className="border-t border-border mb-6" />

            <h1 className="text-2xl font-bold text-card-foreground text-center mb-8">
              Verifikasi Email
            </h1>

            <p className="text-center text-muted-foreground mb-6">
              Masukkan kode verifikasi yang telah dikirim ke email Anda
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-xl text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3E484F]">
                  Kode Verifikasi
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-input rounded-xl text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Verifikasi"}
              </button>
            </form>

            <div className="text-center mt-6">
              <button
                onClick={handleResendCode}
                className="text-primary hover:underline text-sm"
              >
                Kirim ulang kode
              </button>
            </div>

            <p className="text-center text-card-foreground mt-6">
              Kembali ke{" "}
              <Link
                href="/auth/login"
                className="text-primary font-medium hover:underline"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
