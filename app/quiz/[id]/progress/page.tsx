'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Clock, CheckCircle2, Award, TrendingUp, Users, FileText, Download, Eye } from 'lucide-react';
import { Navbar } from '@/components/dashboard/Navbar';
import { useQuizRealtime } from '@/hooks/useQuizRealtime';
import { downloadExcel } from '@/lib/utils/exportExcel';

export default function ProgressPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;
    const quizId = id as string;

    const [quiz, setQuiz] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const fetchProgress = useCallback(
        async (showLoading = true) => {
            try {
                if (showLoading) setLoading(true);
                else setRefreshing(true);

                const res = await fetch(`/api/quiz/${quizId}/progress`, { credentials: 'include' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                setQuiz(data.quiz);
                setParticipants(data.participants || []);
                setStatistics(data.statistics);

                if (data.quiz?.status === 'ongoing') {
                    setQuizStartTime((prev) => {
                        if (prev) return prev;
                        const sessionIso = data.quiz?.waktu_mulai_sesi || data.quiz?.updated_at;
                        if (sessionIso) {
                            const dStr = sessionIso;
                            return new Date(dStr.endsWith('Z') || dStr.includes('+') ? dStr : dStr + 'Z');
                        }
                        const earliest = data.participants?.find((p: any) => p.waktu_mulai);
                        if (earliest?.waktu_mulai) return new Date(earliest.waktu_mulai);
                        const stored = localStorage.getItem(`quiz-start-time-${quizId}`);
                        if (stored) return new Date(stored);
                        const now = new Date();
                        localStorage.setItem(`quiz-start-time-${quizId}`, now.toISOString());
                        return now;
                    });
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Gagal memuat progress');
            } finally {
                if (showLoading) setLoading(false);
                else setRefreshing(false);
            }
        },
        [quizId],
    );

    const debouncedRefresh = useCallback(() => {
        if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = setTimeout(() => fetchProgress(false), 900);
    }, [fetchProgress]);

    const { isConnected } = useQuizRealtime({
        quizId,
        enabled: true,
        onProgressUpdate: debouncedRefresh,
        onParticipantJoin: debouncedRefresh,
        onQuizStatusChange: debouncedRefresh,
    });

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    useEffect(() => {
        if (!quiz || quiz.status !== 'ongoing' || !quizStartTime) return;
        const durationMinutes = quiz.durasi_menit || 0;
        const updateTimer = () => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - quizStartTime.getTime()) / 1000);
            const remaining = Math.max(0, durationMinutes * 60 - elapsed);
            setTimeRemaining(remaining);
            if (remaining === 0 && timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
        updateTimer();
        timerIntervalRef.current = setInterval(updateTimer, 1000);
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [quiz, quizStartTime]);

    const isQuizOngoing = quiz?.status === 'ongoing';

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimeColor = () => {
        if (timeRemaining <= 60) return 'bg-red-500';
        if (timeRemaining <= 300) return 'bg-amber-500';
        return 'bg-cyan-500';
    };

    const getStatusBadge = (status: string) => {
        const effective = isQuizOngoing && status === 'waiting' ? 'started' : status;
        if (effective === 'selesai') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                    <CheckCircle2 className="w-3 h-3" />
                    Selesai
                </span>
            );
        }
        if (effective === 'started' || effective === 'sedang_mengerjakan') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">
                    <Clock className="w-3 h-3" />
                    Mengerjakan
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                <Clock className="w-3 h-3" />
                Menunggu
            </span>
        );
    };

    const getScoreColor = (score: number | null | undefined) => {
        if (score === null || score === undefined || score === 0) return 'text-gray-400';
        if (score >= 80) return 'text-emerald-600';
        if (score >= 60) return 'text-amber-600';
        return 'text-red-600';
    };

    const handleDownloadExcel = () => {
        if (participants.length === 0) return;
        const excelData = participants.map((p, idx) => ({
            'NO': idx + 1,
            'Nama Lengkap': p.nama_siswa,
            'Waktu Mengerjakan': p.durasi_pengerjaan ? `${Math.floor(p.durasi_pengerjaan / 60)}m ${p.durasi_pengerjaan % 60}s` : '-',
            'Nilai Akhir': p.nilai !== null ? p.nilai : '-',
            'Status': p.status_lulus ? 'Lulus' : 'Remedial'
        }));
        downloadExcel(excelData, `Progress_Kuis_${quiz?.judul || 'Data'}`);
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

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar fullWidth showBackButton backButtonText="Back to Dashboard" />
            <main className="pt-20 pb-16">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Progress Kuis'}</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Total {quiz?.total_questions || 0} soal | Durasi {quiz?.durasi_menit || 0} menit | KKM {quiz?.kkm || 70}
                            </p>
                            {isConnected && (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-500 mt-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Live update aktif
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                            <Link
                                href={`/quiz/${quizId}/lihat-soal`}
                                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50"
                            >
                                <Eye className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden />
                                <span className="hidden sm:inline">Lihat soal</span>
                                <span className="sm:hidden">Soal</span>
                            </Link>
                            {isQuizOngoing && (
                                <div className={`flex items-center gap-2 px-5 py-2.5 ${getTimeColor()} text-white rounded-full shadow-sm`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                                    <Clock className="w-5 h-5" />
                                    <span className="font-bold tracking-wider">{formatTime(timeRemaining)}</span>
                                </div>
                            )}
                            {quiz?.status === 'selesai' && (
                                <button
                                    onClick={handleDownloadExcel}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full shadow-sm transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="font-semibold text-sm">Download Nilai Ujian</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <Users className="w-4 h-4" />
                                <span className="text-xs">Total</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{statistics?.totalParticipants || 0}</p>
                            <p className="text-xs text-gray-400">Peserta</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 text-emerald-500 mb-1">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs">Selesai</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-600">{statistics?.completedCount || 0}</p>
                            <p className="text-xs text-gray-400">Peserta</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 text-amber-500 mb-1">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs">Mengerjakan</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-600">{statistics?.inProgressCount || 0}</p>
                            <p className="text-xs text-gray-400">Peserta</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 text-cyan-500 mb-1">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-xs">Rata-rata</span>
                            </div>
                            <p className="text-2xl font-bold text-cyan-600">{statistics?.avgScore || 0}</p>
                            <p className="text-xs text-gray-400">Nilai</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 text-emerald-500 mb-1">
                                <Award className="w-4 h-4" />
                                <span className="text-xs">Tertinggi</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-600">{statistics?.highestScore || 0}</p>
                            <p className="text-xs text-gray-400">Nilai</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 text-blue-500 mb-1">
                                <FileText className="w-4 h-4" />
                                <span className="text-xs">Lulus</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{statistics?.passedCount || 0}</p>
                            <p className="text-xs text-gray-400">Peserta</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="font-semibold text-gray-800">Daftar Peserta</h2>
                            <button onClick={() => fetchProgress(false)} disabled={refreshing} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-50">
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                        <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Siswa</th>
                                        <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                                        <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {participants.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-gray-500">
                                                Belum ada siswa yang bergabung
                                            </td>
                                        </tr>
                                    ) : (
                                        participants.map((p, idx) => (
                                            <tr key={p.peserta_id} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <span
                                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-300' : idx === 2 ? 'bg-amber-500' : 'bg-gray-100'} text-gray-800`}
                                                    >
                                                        {idx + 1}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="font-medium text-gray-800">{p.nama_siswa}</span>
                                                </td>
                                                <td className="py-4 px-6 text-center">{getStatusBadge(p.status)}</td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                            <div className="bg-cyan-400 rounded-full h-2 transition-all duration-300" style={{ width: `${p.progress_percent}%` }} />
                                                        </div>
                                                        <span className="text-xs text-gray-500 min-w-[45px]">
                                                            {p.answered_count}/{p.total_questions}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <span className={`font-bold text-lg ${getScoreColor(p.nilai)}`}>{p.nilai !== null ? p.nilai : '-'}</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
