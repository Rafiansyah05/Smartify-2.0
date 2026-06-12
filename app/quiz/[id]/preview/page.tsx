'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Trash2, Edit2, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/dashboard/Navbar';

export default function PreviewQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');

  useEffect(() => {
    fetchQuizData();
  }, [id]);

  const fetchQuizData = async () => {
    try {
      const res = await fetch(`/api/quiz/${id}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Quiz data:', data);
        setQuiz(data.kuis);
        setQuestions(data.soal || []);
        setAuthorName(data.pembuat);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/quiz/${id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quiz?.judul || 'Kuis'}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Gagal mendownload soal');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mendownload soal');
    }
  };

  const handleDelete = async (soalId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) return;
    try {
      const res = await fetch(`/api/quiz/${id}/questions/${soalId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.soal_id !== soalId));
      } else {
        alert('Gagal menghapus soal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!id) {
      alert('ID kuis tidak valid');
      return;
    }

    try {
      const url = new URL(`/api/quiz/${id}/waiting-room`, window.location.origin);
      const res = await fetch(url.toString(), {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        router.push(`/quiz/${id}/waiting-room`);
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menyimpan kuis');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan kuis');
    }
  };

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
              {i < lines.length - 1 && <br />}
            </span>
          );
        })}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar fullWidth showBackButton backButtonText="Back to Dashboard" />

      <main className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">GENERATE QUIZ {'>'} PREVIEW</p>
                <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
                {authorName && <p className="text-sm text-gray-500 mt-1">Dibuat oleh: {authorName}</p>}
              </div>
              <button onClick={handleDownload} className="flex items-center gap-2 px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white rounded-full font-medium transition-colors shadow-sm">
                <Download className="w-4 h-4" />
                Download Soal
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-10">
            {questions.map((q, index) => (
              <div key={q.soal_id} className="pb-8 border-b border-gray-100 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="font-bold text-gray-800 text-lg">Soal {index + 1}.</h3>
                  <span className="text-xs text-gray-400 uppercase tracking-wider px-3 py-1 bg-gray-100 rounded-full whitespace-nowrap">
                    {q.tipe_soal === 'pilihan_ganda'
                      ? 'Pilihan Ganda'
                      : q.tipe_soal === 'isian_singkat'
                        ? 'Isian Singkat'
                        : quiz?.jenis_soal === 'campuran'
                          ? 'Isian Singkat'
                          : 'Uraian'}
                  </span>
                </div>
                <div className="text-gray-700 mb-6 leading-relaxed">{formatText(q.teks_soal)}</div>

                {q.tipe_soal === 'pilihan_ganda' && q.pilihan && (
                  <div className="space-y-3 mb-8">
                    {q.pilihan.map((p: any, pIndex: number) => {
                      const label = String.fromCharCode(65 + pIndex);
                      return (
                        <div key={p.pilihan_id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-400 text-white text-sm font-bold flex-shrink-0">{label}</div>
                          <span className="text-gray-700">{p.teks_pilihan}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.tipe_soal === 'pilihan_ganda' && q.pilihan && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">Jawaban Benar</p>
                    <div className="bg-emerald-50 px-5 py-3.5 rounded-xl flex items-center gap-4 border border-emerald-200">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex-shrink-0">{String.fromCharCode(65 + q.pilihan.findIndex((p: any) => p.is_benar))}</div>
                      <span className="font-semibold text-gray-800">{q.pilihan.find((p: any) => p.is_benar)?.teks_pilihan}</span>
                    </div>
                  </div>
                )}

                {q.kunci_jawaban?.jawaban_text && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">Penjelasan Jawaban</p>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                      <div className="text-emerald-800 text-sm leading-relaxed">{formatText(q.kunci_jawaban.jawaban_text)}</div>
                    </div>
                  </div>
                )}


              </div>
            ))}

            {questions.length === 0 && <div className="text-center py-12 text-gray-500">Belum ada soal untuk kuis ini.</div>}
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={handleSaveAndContinue}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full shadow-lg shadow-cyan-400/30 transition-all hover:shadow-xl hover:shadow-cyan-400/40"
        >
          Simpan, dan lanjut
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
