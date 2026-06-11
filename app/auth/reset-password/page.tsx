import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-background">
          <main className="flex-1 flex items-center justify-center px-4">
            <p className="text-sm text-muted-foreground">Memuat...</p>
          </main>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
