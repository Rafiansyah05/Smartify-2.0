'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, ArrowRight, Clock, Award, BookOpen, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';


export default function QuizResultPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { id } = params;
    const qrToken = searchParams.get('token');
    const pesertaId = searchParams.get('pesertaId');

    const [quiz, setQuiz] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [participant, setParticipant] = useState<any>(null);
    const [statistics, setStatistics] = useState<any>(null);
    const [questionResults, setQuestionResults] = useState<any[]>([]);

    const [error, setError] = useState('');

    useEffect(() => {
        const fetchResult = async () => {
            try {
                setLoading(true);

                let participantId = pesertaId;
                if (!participantId) {
                    const stored = localStorage.getItem(`quiz-result-${id}-${qrToken}`);
                    if (stored) {
                        const data = JSON.parse(stored);
                        participantId = data.pesertaId;
                        if (participantId) {
                            router.replace(`/quiz/${id}/result?token=${qrToken}&pesertaId=${participantId}`);
                            return;
                        }
                    }
                }

                if (!participantId) {
                    setError('Data hasil tidak ditemukan');
                    setLoading(false);
                    return;
                }

                const res = await fetch(`/api/quiz/${id}/result/${participantId}`, {
                    credentials: 'include',
                });

                if (res.status === 401) {
                    router.push(`/quiz/${id}/take?token=${qrToken}`);
                    return;
                }

                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || 'Gagal memuat hasil');
                    setLoading(false);
                    return;
                }

                setQuiz(data.quiz);
                setParticipant(data.participant);
                setStatistics(data.statistics);
                setQuestionResults(data.questionResults || []);

            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan saat memuat hasil');
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [id, qrToken, pesertaId, router]);

    const formatDuration = (seconds: number | null | undefined) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs} detik`;
        return `${mins} menit ${secs} detik`;
    };

    const handleViewAnswers = () => {
        router.push(`/quiz/${id}/review?token=${qrToken}&pesertaId=${participant?.peserta_id || pesertaId}`);
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

    const userScore = statistics?.score || 0;
    const correctCount = statistics?.correctCount || 0;
    const incorrectCount = statistics?.incorrectCount || 0;
    const totalQuestions = statistics?.totalQuestions || 0;
    const isPassed = userScore >= (quiz?.kkm || 75);

    return (
        <div className="min-h-screen bg-gray-50">

            <header className="sticky top-0 z-30 border-b border-gray-100 bg-white">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
                    <div className="min-w-0">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-emerald-500">SELESAI!!!</p>
                        <h1 className="break-words text-lg font-bold text-gray-800 sm:text-xl">{quiz?.judul || 'Ulangan Harian'}</h1>
                    </div>
                </div>
            </header>

            <div className="mx-auto mt-6 max-w-4xl px-4 pb-28 sm:mt-8 sm:px-6 sm:pb-8">

                <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
                    <div className="mb-6 text-center">
                        <h2 className="mb-2 text-xs uppercase tracking-wider text-gray-400">YOUR FINAL SCORE</h2>

                        <div className="inline-flex flex-col items-center px-2">
                            <div className="text-5xl font-bold tabular-nums leading-none text-cyan-400 sm:text-6xl md:text-7xl">{userScore}</div>
                            <span className="mt-2 text-sm text-gray-400">out of 100</span>
                        </div>

                        <div
                            className={`mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 rounded-full ${isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                        >
                            {isPassed ? <ThumbsUp className="h-4 w-4 shrink-0" /> : <ThumbsDown className="h-4 w-4 shrink-0" />}
                            <span className="text-sm font-medium">{isPassed ? 'LULUS' : 'TIDAK LULUS'}</span>
                            {!isPassed && <span className="text-xs">(KKM: {quiz?.kkm || 75})</span>}
                        </div>
                    </div>


                    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                        <div className="rounded-xl bg-emerald-50 p-4 text-center">
                            <div className="mb-1 flex items-center justify-center gap-2">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                                <span className="font-medium text-emerald-600">Benar</span>
                            </div>
                            <span className="text-2xl font-bold tabular-nums text-emerald-600">{correctCount}</span>
                            <span className="ml-1 text-xs text-emerald-500">soal</span>
                        </div>
                        <div className="rounded-xl bg-red-50 p-4 text-center">
                            <div className="mb-1 flex items-center justify-center gap-2">
                                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                                <span className="font-medium text-red-600">Salah</span>
                            </div>
                            <span className="text-2xl font-bold tabular-nums text-red-600">{incorrectCount}</span>
                            <span className="ml-1 text-xs text-red-500">soal</span>
                        </div>
                    </div>


                    <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 sm:gap-4">
                        <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex shrink-0 items-center gap-2 text-gray-600">
                                <Clock className="h-4 w-4 shrink-0" />
                                <span>Waktu Pengerjaan</span>
                            </div>
                            <span className="break-words font-medium text-gray-800 sm:text-right">{formatDuration(participant?.durasi_pengerjaan)}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex shrink-0 items-center gap-2 text-gray-600">
                                <Award className="h-4 w-4 shrink-0" />
                                <span>Total Soal</span>
                            </div>
                            <span className="font-medium text-gray-800 sm:text-right">{totalQuestions} soal</span>
                        </div>
                    </div>
                </div>

                <div className="hidden sm:mb-8 sm:flex sm:justify-end">
                    <button
                        type="button"
                        onClick={handleViewAnswers}
                        className="flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-400/30 transition-all hover:bg-cyan-500 hover:shadow-xl hover:shadow-cyan-400/40"
                    >
                        Lihat Jawaban & Pembahasan
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
            </div>


            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:hidden">
                <button
                    type="button"
                    onClick={handleViewAnswers}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 font-semibold text-white shadow-md transition-colors hover:bg-cyan-500"
                >
                    Lihat Jawaban & Pembahasan
                    <ArrowRight className="h-5 w-5 shrink-0" />
                </button>
            </div>
        </div>
    );
}
