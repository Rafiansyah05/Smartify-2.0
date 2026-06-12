'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/dashboard/Navbar';

export default function LihatSoalProgressPage() {
  const params = useParams();
  const { id } = params;
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quiz/${id}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat soal');
        if (cancelled) return;
        setQuiz(data.kuis);
        setQuestions(data.soal || []);
        setAuthorName(data.pembuat || '');
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Gagal memuat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const formatText = (text?: string) => {
    if (!text) return null;
    const lines = text.split(/<br\s*\/?>|\n/g);

    return (
      <>
        {lines.map((line, i) => {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <span key={i}>
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <strong key={j} className="font-bold">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <span key={j}>{part}</span>;
              })}
              {i < lines.length - 1 ? <br /> : null}
            </span>
          );
        })}
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 text-xl font-bold text-gray-800">Tidak dapat menampilkan soal</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        fullWidth
        showBackButton
        backButtonText="Kembali ke progress"
        backHref={id ? `/quiz/${id}/progress` : '/dashboard'}
      />

      <main className="px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">PROGRESS KUIS {'>'} LIHAT SOAL</p>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">{quiz?.judul || 'Kuis'}</h1>
            {authorName ? <p className="mt-1 text-sm text-gray-500">Dibuat oleh: {authorName}</p> : null}
            <p className="mt-3 text-sm text-gray-500">Tampilan jawaban dan penjelasan sama seperti pratinjau kuis.</p>
          </div>

          <div className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            {questions.map((q, index) => (
              <div key={q.soal_id} className="border-b border-gray-100 pb-8 last:border-b-0 last:pb-0">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-lg font-bold text-gray-800">Soal {index + 1}.</h3>
                  <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs uppercase tracking-wider text-gray-500">
                    {q.tipe_soal === 'pilihan_ganda'
                      ? 'Pilihan Ganda'
                      : q.tipe_soal === 'isian_singkat'
                        ? 'Isian Singkat'
                        : quiz?.jenis_soal === 'campuran'
                          ? 'Isian Singkat'
                          : 'Uraian'}
                  </span>
                </div>
                <div className="mb-6 leading-relaxed text-gray-700">{formatText(q.teks_soal)}</div>

                {q.tipe_soal === 'pilihan_ganda' && q.pilihan && (
                  <div className="mb-6 space-y-3">
                    {q.pilihan.map((p: any, pIndex: number) => {
                      const label = String.fromCharCode(65 + pIndex);
                      return (
                        <div key={p.pilihan_id} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-white">{label}</div>
                          <span className="text-gray-700">{p.teks_pilihan}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.tipe_soal === 'pilihan_ganda' && q.pilihan && (
                  <div className="mb-6">
                    <p className="mb-2 text-sm text-gray-500">Jawaban Benar</p>
                    <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 sm:px-5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                        {String.fromCharCode(65 + Math.max(0, q.pilihan.findIndex((p: any) => p.is_benar)))}
                      </div>
                      <span className="font-semibold text-gray-800">{q.pilihan.find((p: any) => p.is_benar)?.teks_pilihan}</span>
                    </div>
                  </div>
                )}

                {q.kunci_jawaban?.jawaban_text && (
                  <div>
                    <p className="mb-2 text-sm text-gray-500">Penjelasan Jawaban</p>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                      <div className="text-sm leading-relaxed text-emerald-800">{formatText(q.kunci_jawaban.jawaban_text)}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {questions.length === 0 ? <div className="py-12 text-center text-gray-500">Belum ada soal.</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
