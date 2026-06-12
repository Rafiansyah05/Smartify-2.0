'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Calendar, MoreVertical, Trash2 } from 'lucide-react';

interface QuizCardProps {
  id: string | number;
  title: string;
  totalSoal: number;
  tanggal: string;
  copyright?: string;
  status?: 'draft' | 'published' | 'ongoing';
  jumlahPeserta?: number;
  onDeleted?: () => void;
}

export function QuizCard({
  id,
  title,
  totalSoal,
  tanggal,
  copyright = 'Smartify Quiz',
  status = 'published',
  jumlahPeserta = 0,
  onDeleted,
}: QuizCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const idStr = String(id);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/quiz/${idStr}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus kuis');
        return;
      }
      setConfirmOpen(false);
      setMenuOpen(false);
      onDeleted?.();
    } catch {
      alert('Terjadi kesalahan saat menghapus kuis');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="h-1.5 bg-primary" />

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{copyright}</span>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-input"
              aria-label="Menu kuis"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <>
                <button type="button" className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-card py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-input"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus kuis
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <Link href={`/quiz/${idStr}/detail`} onClick={() => setMenuOpen(false)}>
          <h3 className="mb-4 line-clamp-2 text-base font-semibold text-card-foreground transition-colors hover:text-primary">{title}</h3>
        </Link>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground sm:gap-4">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 shrink-0" />
            <span>{totalSoal} Soal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{tanggal}</span>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-card-foreground">Hapus kuis?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Kuis &quot;{title}&quot; beserta soal, peserta, dan data terkait akan dihapus permanen dari akun Anda. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-input disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
