'use client';

import { useState, useEffect } from 'react';
// import { QuizCard } from '@/components/dashboard/QuizCard';
import { Search, FileText, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchQuizzes = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.quizzes || []);
      } else if (res.status === 401) {
        window.location.href = '/auth/login';
      }
    } catch (err) {
      console.error('Fetch quizzes error:', err);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredQuizzes = quizzes.filter((quiz) => quiz.judul?.toLowerCase().includes(q));
  const hasAnyQuiz = quizzes.length > 0;
  const searchActive = searchQuery.trim().length > 0;
  const searchHasNoMatch = searchActive && hasAnyQuiz && filteredQuizzes.length === 0;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">DASHBOARD</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-bold text-card-foreground sm:text-2xl">Koleksi Kuis Saya</h1>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative w-full sm:max-w-xs lg:w-80">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Cari kuis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border-0 bg-input py-3 pl-12 pr-4 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex items-center rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-initial sm:px-4 ${
                  viewMode === 'grid' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-card-foreground'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-initial sm:px-4 ${
                  viewMode === 'list' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-card-foreground'
                }`}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !searchHasNoMatch ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-4'}>
          {/* {filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.kuis_id}
              id={quiz.kuis_id}
              title={quiz.judul}
              totalSoal={quiz.total_soal}
              tanggal={formatDate(quiz.created_at)}
              copyright={quiz.kelas || 'Smartify Quiz'}
              status={quiz.status || 'draft'}
              onDeleted={() => fetchQuizzes({ silent: true })}
            />
          ))} */}
        </div>
      ) : null}

      {!loading && searchHasNoMatch && (
        <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-card-foreground">Kuis tidak ditemukan</h3>
          <p className="mt-2 text-sm text-muted-foreground">Tidak ada judul kuis yang cocok dengan &ldquo;{searchQuery.trim()}&rdquo;. Coba kata kunci lain.</p>
          <Link
            href="/generate"
            className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Buat kuis sekarang
          </Link>
        </div>
      )}

      {!loading && !hasAnyQuiz && (
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800">Belum ada kuis</h3>
          <p className="mb-4 mt-1 text-gray-500">Mulai buat kuis pertama Anda</p>
          <Link
            href="/generate"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Buat Kuis Baru
          </Link>
        </div>
      )}
    </div>
  );
}
