"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/footer/footer";
import { MailIcon } from "lucide-react";
import { onPasswordResetComplete } from "@/lib/auth/password-reset-broadcast";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    return onPasswordResetComplete(() => {
      router.replace("/auth/login");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
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

            {!sent ? (
              <>
                <h1 className="text-2xl font-bold text-card-foreground text-center mb-2">
                  Lupa password?
                </h1>
                <p className="text-center text-muted-foreground text-sm mb-8 px-1">
                  Masukkan email yang terdaftar. Kami akan mengirimkan tautan
                  aman untuk mengatur ulang password Anda.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-[#3E484F]"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MailIcon className="h-5 w-5 text-muted" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-12 pr-4 py-3 bg-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Mengirim..." : "Kirim tautan reset"}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <MailIcon className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-card-foreground">
                  Periksa email Anda
                </h1>
                <p className="text-[#3E484F] text-sm leading-relaxed">
                  Jika alamat ini terhubung dengan akun Smartify, email berisi
                  tautan atur ulang password telah dikirim. Buka pesan tersebut,
                  ketuk{" "}
                  <span className="font-medium text-card-foreground">
                    Atur password baru
                  </span>
                  , lalu buat password yang kuat. Setelah selesai, kembali ke
                  halaman masuk untuk login dengan password yang baru.
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Tidak melihat email? Periksa folder spam atau promosi. Tautan
                  biasanya berlaku satu jam demi keamanan akun Anda.
                </p>
                <Link
                  href="/auth/login"
                  className="inline-block w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors text-center"
                >
                  Kembali ke masuk
                </Link>
              </div>
            )}

            <p className="text-center text-card-foreground mt-6 text-sm">
              Ingat password Anda?{" "}
              <Link
                href="/auth/login"
                className="text-primary font-medium hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
