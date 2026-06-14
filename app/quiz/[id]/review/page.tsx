'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Lightbulb, ListChecks } from 'lucide-react';
import { Navbar } from '@/components/dashboard/Navbar';
import { MobileQuizDrawer } from '@/components/quiz/MobileQuizDrawer';

interface QuestionResult {
    soal_id: number;
    teks_soal: string;
    tipe_soal: 'pilihan_ganda' | 'isian_singkat' | 'uraian';
    urutan: number;
    poin_maksimal: number;
    pilihan: Array<{
        pilihan_id: number;
        teks_pilihan: string;
        is_benar: boolean;
        urutan: number;
    }>;
    jawaban_benar: string;
    penjelasan: string | null;
    jawaban_siswa: string | null;
    is_benar: boolean;
    poin_dapat: number;
}

export default function QuizReviewPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { id } = params;
    const qrToken = searchParams.get('token');
    const pesertaId = searchParams.get('pesertaId');

    const [quiz, setQuiz] = useState<any>(null);
    const [participant, setParticipant] = useState<any>(null);
    const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
    const [statistics, setStatistics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'all' | 'incorrect'>('all');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const filteredQuestions = viewMode === 'incorrect' ? questionResults.filter((q) => !q.is_benar) : questionResults;
    const currentQuestion = filteredQuestions[currentIndex];

    const typeBadge = (t: QuestionResult['tipe_soal']) => {
        if (t === 'pilihan_ganda') return 'Pilihan Ganda';
        if (t === 'isian_singkat') return 'Isian Singkat';
        return 'Uraian';
    };

    const getQuestionStatusUI = (q: QuestionResult) => {
        if (q.tipe_soal === 'uraian' || q.tipe_soal === 'isian_singkat') {
            if (q.poin_dapat === q.poin_maksimal && q.poin_maksimal > 0) {
                return { text: 'Benar', bg: 'bg-emerald-100', textCol: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> };
            } else if (q.poin_dapat > 0 && q.poin_dapat < q.poin_maksimal) {
                return { text: 'Sebagian Benar', bg: 'bg-yellow-100', textCol: 'text-yellow-700', border: 'border-yellow-200', icon: <CheckCircle2 className="w-4 h-4" /> };
            } else {
                return { text: 'Salah', bg: 'bg-red-100', textCol: 'text-red-700', border: 'border-red-200', icon: <XCircle className="w-4 h-4" /> };
            }
        }
        if (q.is_benar) {
            return { text: 'Benar', bg: 'bg-emerald-100', textCol: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> };
        }
        return { text: 'Salah', bg: 'bg-red-100', textCol: 'text-red-700', border: 'border-red-200', icon: <XCircle className="w-4 h-4" /> };
    };

    useEffect(() => {
        const fetchReview = async () => {
            try {
                setLoading(true);

                let targetPesertaId = pesertaId;
                if (!targetPesertaId) {
                    const stored = localStorage.getItem(`quiz-result-${id}-${qrToken}`);
                    if (stored) {
                        const data = JSON.parse(stored);
                        targetPesertaId = data.pesertaId;
                        if (targetPesertaId) {
                            router.replace(`/quiz/${id}/review?token=${qrToken}&pesertaId=${targetPesertaId}`);
                            return;
                        }
                    }
                    setError('Data peserta tidak ditemukan');
                    setLoading(false);
                    return;
                }

                const res = await fetch(`/api/quiz/${id}/result/${targetPesertaId}`, {
                    credentials: 'include',
                });
                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || 'Gagal memuat data');
                    return;
                }

                setQuiz(data.quiz);
                setParticipant(data.participant);
                setQuestionResults(data.questionResults || []);
                setStatistics(data.statistics);
            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan saat memuat data');
            } finally {
                setLoading(false);
            }
        };

        fetchReview();
    }, [id, qrToken, pesertaId, router]);

    const formatText = (text?: string | null) => {
        if (!text) return null;
        const lines = text.split(/<br\s*\/?>|\n/g);
        return lines.map((line, i) => {
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
        });
    };

    const handlePrevious = () => {
        if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
    };

    const handleNext = () => {
        if (currentIndex < filteredQuestions.length - 1) setCurrentIndex((prev) => prev + 1);
    };

    const handleQuestionJump = (index: number) => {
        setCurrentIndex(index);
        setMobileNavOpen(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                    <button onClick={() => router.push('/dashboard')} className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
                        Kembali ke Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const userScore = participant?.nilai || 0;
    const correctCount = statistics?.correctCount || 0;
    const incorrectCount = statistics?.incorrectCount || 0;
    const totalQuestions = statistics?.totalQuestions || 0;

    const reviewSidebarInner = filteredQuestions.length > 0 && (
        <>
            <h3 className="mb-4 text-sm font-semibold text-gray-800">Navigasi Soal</h3>

            <div className="mb-6 grid grid-cols-6 gap-2">
                {filteredQuestions.map((q, idx) => {
                    const isCurrent = idx === currentIndex;
                    const ui = getQuestionStatusUI(q);
                    return (
                        <button
                            key={q.soal_id}
                            type="button"
                            onClick={() => handleQuestionJump(idx)}
                            className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${isCurrent ? 'bg-cyan-400 text-white' : `${ui.bg} ${ui.textCol}`}`}
                        >
                            {viewMode === 'all' ? q.urutan : idx + 1}
                        </button>
                    );
                })}
            </div>

            <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <p className="mb-3 text-xs font-medium text-gray-500">Keterangan:</p>
                <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-cyan-400" />
                        <span className="text-gray-600">Soal saat ini</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded border border-emerald-200 bg-emerald-100" />
                        <span className="text-gray-600">Jawaban benar</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded border border-yellow-200 bg-yellow-100" />
                        <span className="text-gray-600">Sebagian benar</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded border border-red-200 bg-red-100" />
                        <span className="text-gray-600">Jawaban salah</span>
                    </div>
                </div>
            </div>

            <div className="rounded-xl bg-cyan-50 p-4">
                <p className="mb-3 text-xs font-semibold text-cyan-700">RINGKASAN NILAI</p>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Total Soal:</span>
                        <span className="font-medium text-gray-800">{totalQuestions}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-emerald-600">Benar:</span>
                        <span className="font-medium text-emerald-600">{correctCount}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-red-600">Salah:</span>
                        <span className="font-medium text-red-600">{incorrectCount}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-cyan-200 pt-2">
                        <span className="font-semibold text-gray-800">Nilai Akhir:</span>
                        <span className="text-lg font-bold text-cyan-600">{userScore}</span>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={() => router.push(`/quiz/${id}/result?token=${qrToken}&pesertaId=${pesertaId}`)}
                className="mt-4 w-full rounded-lg border border-gray-200 bg-white py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
                ← Kembali ke Hasil
            </button>
        </>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar fullWidth showBackButton backButtonText="Back to Dashboard" />

            <MobileQuizDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Navigasi soal">
                {filteredQuestions.length > 0 ? reviewSidebarInner : null}
            </MobileQuizDrawer>

            <main className="overflow-x-hidden pb-16 pt-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                    {/* Header Info */}
                    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">EVALUASI KUIS</p>
                                <h1 className="line-clamp-2 text-lg font-bold text-gray-800 sm:text-xl">{quiz?.judul || 'Ulangan Harian'}</h1>
                                <p className="mt-1 truncate text-sm text-gray-500 sm:whitespace-normal">
                                    <span>{participant?.nama_siswa}</span> • Nilai:{' '}
                                    <span className="font-bold text-cyan-500">{userScore}</span>
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {filteredQuestions.length > 0 && (
                                    <button
                                        type="button"
                                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm lg:hidden"
                                        onClick={() => setMobileNavOpen(true)}
                                    >
                                        <ListChecks className="h-4 w-4 text-cyan-500" aria-hidden />
                                        Soal ({currentIndex + 1}/{filteredQuestions.length})
                                    </button>
                                )}


                                <div className="flex flex-1 items-center gap-1 rounded-full bg-gray-100 p-1 sm:flex-initial sm:gap-2">
                                    <button
                                        onClick={() => {
                                            setViewMode('all');
                                            setCurrentIndex(0);
                                        }}
                                        className={`rounded-full px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${viewMode === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Semua Soal ({totalQuestions})
                                    </button>
                                    <button
                                        onClick={() => {
                                            setViewMode('incorrect');
                                            setCurrentIndex(0);
                                        }}
                                        className={`rounded-full px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${viewMode === 'incorrect' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Hanya Salah ({incorrectCount})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {filteredQuestions.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-gray-800 mb-2">Semua Jawaban Benar!</h2>
                            <p className="text-gray-500">Selamat, Anda tidak memiliki jawaban yang salah.</p>
                            <button onClick={() => router.push(`/quiz/${id}/result?token=${qrToken}&pesertaId=${pesertaId}`)} className="mt-6 px-6 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white rounded-full font-medium transition-colors">
                                Kembali ke Hasil
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,320px)] lg:gap-8">

                            <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
                                {currentQuestion && (
                                    <>

                                        <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-lg font-bold text-gray-800">Soal {viewMode === 'all' ? currentQuestion.urutan : currentIndex + 1}</h2>
                                                <span className="text-xs text-gray-400 uppercase tracking-wider px-3 py-1 bg-gray-100 rounded-full">{typeBadge(currentQuestion.tipe_soal)}</span>
                                            </div>
                                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getQuestionStatusUI(currentQuestion).bg} ${getQuestionStatusUI(currentQuestion).textCol}`}>
                                                {getQuestionStatusUI(currentQuestion).icon}
                                                <span className="text-sm font-medium">{getQuestionStatusUI(currentQuestion).text}</span>
                                            </div>
                                        </div>


                                        <div className="mb-6 rounded-xl bg-gray-50 p-4">
                                            <div className="break-words leading-relaxed text-gray-700">{formatText(currentQuestion.teks_soal)}</div>
                                        </div>


                                        {currentQuestion.tipe_soal === 'pilihan_ganda' && currentQuestion.pilihan && (
                                            <div className="space-y-3 mb-6">
                                                {[...currentQuestion.pilihan]
                                                    .sort((a, b) => a.urutan - b.urutan)
                                                    .map((option, idx) => {
                                                        const label = String.fromCharCode(65 + idx);
                                                        const isCorrect = option.is_benar;
                                                        const isSelected = currentQuestion.jawaban_siswa === option.teks_pilihan;

                                                        let bgClass = 'border-gray-100 bg-white';
                                                        let labelClass = 'bg-gray-200 text-gray-700';
                                                        let textClass = 'text-gray-700';
                                                        let icon = null;

                                                        if (isCorrect) {
                                                            bgClass = 'border-emerald-300 bg-emerald-50';
                                                            labelClass = 'bg-emerald-500 text-white';
                                                            textClass = 'text-emerald-700';
                                                            icon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
                                                        } else if (isSelected && !isCorrect) {
                                                            bgClass = 'border-red-300 bg-red-50';
                                                            labelClass = 'bg-red-500 text-white';
                                                            textClass = 'text-red-700';
                                                            icon = <XCircle className="w-5 h-5 text-red-500" />;
                                                        }

                                                        return (
                                                            <div key={option.pilihan_id} className={`flex items-center gap-4 p-4 rounded-xl border-2 ${bgClass}`}>
                                                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${labelClass}`}>{label}</div>
                                                                <span className={`font-medium flex-1 ${textClass}`}>{option.teks_pilihan}</span>
                                                                {icon}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}


                                        {(currentQuestion.tipe_soal === 'uraian' || currentQuestion.tipe_soal === 'isian_singkat') && (
                                            <div className="space-y-4 mb-6">
                                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Jawaban Anda:</p>
                                                    <p className="text-gray-700">{currentQuestion.jawaban_siswa || <span className="text-red-400 italic">Tidak dijawab</span>}</p>
                                                </div>
                                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2">Kunci Jawaban:</p>
                                                    <p className="text-emerald-700">{currentQuestion.jawaban_benar || 'Tidak ada kunci jawaban'}</p>
                                                </div>
                                            </div>
                                        )}


                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-6">
                                            <span className="text-sm text-gray-600">Poin yang didapat:</span>
                                            <span className={`font-bold ${currentQuestion.is_benar ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {currentQuestion.poin_dapat} / {currentQuestion.poin_maksimal}
                                            </span>
                                        </div>


                                        {currentQuestion.tipe_soal === 'pilihan_ganda' && currentQuestion.penjelasan && (
                                            <div className="p-5 bg-cyan-50 rounded-xl border border-cyan-100 mb-6">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                                                        <Lightbulb className="w-4 h-4 text-cyan-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-cyan-800 mb-2">Penjelasan:</p>
                                                        <div className="text-sm text-cyan-700 leading-relaxed">{formatText(currentQuestion.penjelasan)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}


                                        <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-6 sm:gap-4">
                                            <span className="mr-auto text-sm text-gray-500">
                                                Soal {currentIndex + 1} dari {filteredQuestions.length}
                                            </span>
                                            <button
                                                onClick={handlePrevious}
                                                disabled={currentIndex === 0}
                                                className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                                Sebelumnya
                                            </button>

                                            <button
                                                onClick={handleNext}
                                                disabled={currentIndex === filteredQuestions.length - 1}
                                                className="flex items-center gap-2 px-6 py-3 bg-[#42bbed] hover:bg-[#3ba8d5] text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Selanjutnya
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <aside className="hidden h-fit min-w-[280px] lg:sticky lg:top-24 lg:block">
                                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">{reviewSidebarInner}</div>
                            </aside>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
