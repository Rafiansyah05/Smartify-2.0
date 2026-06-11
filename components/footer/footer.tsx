import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full py-6 px-6 bg-card border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="font-semibold text-card-foreground">
            Smartify AI
          </span>
          <span className="text-sm text-muted">
            &copy; 2026 Smartify AI. Precision in Learning.
          </span>
        </div>
        <nav className="flex items-center gap-8">
          <Link
            href="/help"
            className="text-sm text-muted hover:text-card-foreground transition-colors"
          >
            Help Center
          </Link>
          <Link
            href="/contact"
            className="text-sm text-muted hover:text-card-foreground transition-colors"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
