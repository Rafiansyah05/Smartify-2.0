'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Clock, AlertTriangle, ShieldAlert, ListChecks } from 'lucide-react';
import { MobileQuizDrawer } from '@/components/quiz/MobileQuizDrawer';

interface Question {
    soal_id: number;
    teks_soal: string;
    tipe_soal: 'pilihan_ganda' | 'isian_singkat' | 'uraian';
    pilihan?: Array<{
        pilihan_id: number;
        teks_pilihan: string;
    }>;
}

export default function TakeQuizPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { id } = params;
    const qrToken = searchParams.get('token');

    const [quiz, setQuiz] = useState<any>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [participant, setParticipant] = useState<any>(null);
    const [autoSubmitting, setAutoSubmitting] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | ''>('');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const hasSubmittedRef = useRef(false);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const tabViolationCountRef = useRef(0);
    const leaveEpisodeActiveRef = useRef(false);
    const quizAntiCheatReadyRef = useRef(false);
    const pendingTabWarningStrikeRef = useRef<0 | 1 | 2>(0);
    const blurDelayTimerRef = useRef<number | null>(null);
    const handleSubmitRef = useRef<(opts?: { auto?: boolean; cheating?: boolean }) => Promise<void>>(async () => { });

    const [tabLeaveWarningModal, setTabLeaveWarningModal] = useState<{ strike: 1 | 2 } | null>(null);
    const [autoSubmitReason, setAutoSubmitReason] = useState<'time' | 'cheating' | null>(null);

    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    const totalQuestions = shuffledQuestions.length;
    const answeredCount = Object.keys(answers).length;

    const getParticipantStorageKey = useCallback(() => {
        return `quiz-participant-${id}`;
    }, [id]);

    const getWaitingRoomStorageKey = useCallback(() => {
        return `waiting-room-${id}-${qrToken}`;
    }, [id, qrToken]);

    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    const loadParticipantFromStorage = useCallback(() => {
        const sources = [
            { key: getParticipantStorageKey(), type: 'localStorage' },
            { key: getWaitingRoomStorageKey(), type: 'localStorage' },
            { key: `quiz-session-${id}`, type: 'sessionStorage' },
        ];

        for (const source of sources) {
            try {
                const stored = source.type === 'localStorage' ? localStorage.getItem(source.key) : sessionStorage.getItem(source.key);

                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.peserta_id) {
                        console.log(`Loaded participant from ${source.type}[${source.key}]:`, parsed);
                        return parsed;
                    }
                }
            } catch (e) {
                console.error(`Failed to parse from ${source.key}:`, e);
            }
        }
        return null;
    }, [id, getParticipantStorageKey, getWaitingRoomStorageKey]);

    const fetchQuiz = async () => {
        try {
            setLoading(true);

            const participantData = loadParticipantFromStorage();

            if (participantData) {
                console.log('Loaded participant from storage:', participantData);
                setParticipant(participantData);
            } else {
                console.log('No participant found in storage');
                setError('Data peserta tidak ditemukan. Silakan scan QR code kembali.');
                setLoading(false);
                return;
            }

            const pesertaId = participantData.peserta_id;
            const res = await fetch(`/api/quiz/${id}?token=${encodeURIComponent(qrToken || '')}&pesertaId=${pesertaId}`, {
                credentials: 'include',
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 403 && data?.code === 'JOIN_REQUIRED') {
                    setError(data.error || 'Silakan masuk melalui ruang tunggu dan isi nama lengkap terlebih dahulu.');
                } else {
                    setError(data.error || 'Gagal memuat kuis');
                }
                return;
            }

            if (data.kuis?.status !== 'ongoing') {
                setError('Kuis belum dimulai atau sudah berakhir');
                return;
            }

            setQuiz(data.kuis);
            setQuestions(data.soal || []);


            const shuffled = shuffleArray<Question>(data.soal || []);
            const shuffledWithChoices = shuffled.map((q: Question) => ({
                ...q,
                pilihan: q.tipe_soal === 'pilihan_ganda' && q.pilihan ? shuffleArray(q.pilihan) : q.pilihan,
            }));
            setShuffledQuestions(shuffledWithChoices);

            if (typeof data.timeRemainingSeconds === 'number' && data.timeRemainingSeconds >= 0) {
                setTimeRemaining(data.timeRemainingSeconds);
            } else if (data.kuis?.durasi_menit) {
                setTimeRemaining(data.kuis.durasi_menit * 60);
            }

            const savedAnswers = localStorage.getItem(`quiz-answers-${id}-${qrToken}`);
            if (savedAnswers) {
                try {
                    const parsed = JSON.parse(savedAnswers);
                    setAnswers(parsed);
                } catch (e) {
                    console.error('Failed to restore answers', e);
                }
            }
        } catch (err) {
            console.error(err);
            setError('Terjadi kesalahan saat memuat kuis');
        } finally {
            setLoading(false);
        }
    };

    const saveAnswersLocally = useCallback(() => {
        if (Object.keys(answers).length > 0) {
            localStorage.setItem(`quiz-answers-${id}-${qrToken}`, JSON.stringify(answers));
        }
    }, [answers, id, qrToken]);

    useEffect(() => {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        if (Object.keys(answers).length > 0) {
            setSaveStatus('saving');
            autoSaveTimeoutRef.current = setTimeout(() => {
                saveAnswersLocally();

                if (participant?.peserta_id && qrToken) {
                    fetch(`/api/quiz/${id}/save-progress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pesertaId: participant.peserta_id,
                            answers: answers,
                            token: qrToken,
                        }),
                    }).catch(console.error);
                }

                setSaveStatus('saved');
                setTimeout(() => setSaveStatus(''), 2000);
            }, 1000);
        }

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [answers, saveAnswersLocally, participant?.peserta_id, id, qrToken]);

    const handleSubmit = useCallback(
        async (opts?: { auto?: boolean; cheating?: boolean }) => {
            const auto = opts?.auto === true;
            const cheating = opts?.cheating === true;
            const isAutoSubmit = auto || cheating;

            if (hasSubmittedRef.current) return;

            if (!participant?.peserta_id) {
                console.error('No peserta_id found:', participant);
                setError('Data peserta tidak ditemukan. Silakan refresh halaman.');
                return;
            }

            console.log('Submitting with pesertaId:', participant.peserta_id);

            hasSubmittedRef.current = true;
            setSubmitting(true);
            if (cheating) setAutoSubmitReason('cheating');
            else if (auto) setAutoSubmitReason('time');
            if (isAutoSubmit) setAutoSubmitting(true);

            try {
                const res = await fetch(`/api/quiz/${id}/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pesertaId: participant.peserta_id,
                        answers,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Gagal mengirim jawaban');
                }

                localStorage.removeItem(`quiz-answers-${id}-${qrToken}`);
                localStorage.removeItem(getParticipantStorageKey());
                localStorage.removeItem(getWaitingRoomStorageKey());
                sessionStorage.removeItem(`quiz-session-${id}`);

                localStorage.removeItem(`waiting-room-${id}-${qrToken}`);

                console.log('✅ All storage cleared after successful submission');

                localStorage.setItem(
                    `quiz-result-${id}-${qrToken}`,
                    JSON.stringify({
                        ...data.result,
                        participantName: participant.nama_siswa,
                        pesertaId: participant.peserta_id,
                        ...(typeof data.aiGradingFallbackNote === 'string' ? { aiGradingFallbackNote: data.aiGradingFallbackNote } : {}),
                    }),
                );

                router.push(`/quiz/${id}/result?token=${qrToken}&pesertaId=${participant.peserta_id}`);
            } catch (err: any) {
                console.error('Submit error:', err);
                hasSubmittedRef.current = false;
                setError(err.message || 'Gagal mengirim jawaban');
                setSubmitting(false);
                setAutoSubmitting(false);
                setAutoSubmitReason(null);
            }
        },
        [participant, answers, id, qrToken, router, getParticipantStorageKey, getWaitingRoomStorageKey],
    );

    handleSubmitRef.current = handleSubmit;

    useEffect(() => {
        if (timeRemaining <= 0 || loading) return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    if (!hasSubmittedRef.current) {
                        handleSubmit({ auto: true });
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeRemaining, loading, handleSubmit]);

    useEffect(() => {
        if (!id || !qrToken) {
            setError('Token tidak valid');
            return;
        }
        fetchQuiz();
    }, [id, qrToken]);

    useEffect(() => {
        const keys = ['n', 'nomor', 'soal', 'q', 'question'];
        if (typeof window === 'undefined' || !keys.some((k) => searchParams.has(k))) return;
        const u = new URL(window.location.href);
        keys.forEach((k) => u.searchParams.delete(k));
        window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
    }, [searchParams]);

    useEffect(() => {
        if (!id || !qrToken || !participant?.peserta_id || loading || error) return;
        const sync = async () => {
            try {
                const res = await fetch(`/api/quiz/${id}?token=${encodeURIComponent(qrToken)}&pesertaId=${participant.peserta_id}`, {
                    credentials: 'include',
                });
                const data = await res.json();
                if (res.ok && typeof data.timeRemainingSeconds === 'number') {
                    setTimeRemaining(data.timeRemainingSeconds);
                }
            } catch {
                /* ignore */
            }
        };
        const t = window.setInterval(sync, 45000);
        return () => window.clearInterval(t);
    }, [id, qrToken, participant?.peserta_id, loading, error]);

    useEffect(() => {
        if (loading || error || !quiz) {
            quizAntiCheatReadyRef.current = false;
            return;
        }
        quizAntiCheatReadyRef.current = false;
        const t = window.setTimeout(() => {
            quizAntiCheatReadyRef.current = true;
        }, 900);
        return () => window.clearTimeout(t);
    }, [loading, error, quiz]);

    const flushPendingTabWarning = useCallback(() => {
        const strike = pendingTabWarningStrikeRef.current;
        if (strike === 1 || strike === 2) {
            pendingTabWarningStrikeRef.current = 0;
            setTabLeaveWarningModal({ strike });
        }
    }, []);

    const recordTabLeaveViolation = useCallback(() => {
        if (!quizAntiCheatReadyRef.current || hasSubmittedRef.current) return;

        if (leaveEpisodeActiveRef.current) return;
        leaveEpisodeActiveRef.current = true;
        window.setTimeout(() => {
            leaveEpisodeActiveRef.current = false;
        }, 750);

        tabViolationCountRef.current += 1;
        const strike = tabViolationCountRef.current;

        if (strike >= 3) {
            pendingTabWarningStrikeRef.current = 0;
            void handleSubmitRef.current({ auto: true, cheating: true });
            return;
        }
        pendingTabWarningStrikeRef.current = strike as 1 | 2;
    }, []);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                recordTabLeaveViolation();
            } else if (document.visibilityState === 'visible') {
                flushPendingTabWarning();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [recordTabLeaveViolation, flushPendingTabWarning]);


    useEffect(() => {
        const clearBlurTimer = () => {
            if (blurDelayTimerRef.current) {
                window.clearTimeout(blurDelayTimerRef.current);
                blurDelayTimerRef.current = null;
            }
        };

        const onBlur = () => {
            clearBlurTimer();
            blurDelayTimerRef.current = window.setTimeout(() => {
                blurDelayTimerRef.current = null;
                if (!quizAntiCheatReadyRef.current || hasSubmittedRef.current) return;
                if (document.visibilityState === 'hidden') return;
                if (typeof document.hasFocus === 'function' && document.hasFocus()) return;
                recordTabLeaveViolation();
            }, 240);
        };

        const onFocus = () => {
            clearBlurTimer();
            flushPendingTabWarning();
        };

        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        return () => {
            clearBlurTimer();
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
        };
    }, [recordTabLeaveViolation, flushPendingTabWarning]);

    // Warn before leaving page
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!hasSubmittedRef.current && Object.keys(answers).length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [answers]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

    const handleAnswerSelect = (answer: string) => {
        if (!currentQuestion) return;
        setAnswers((prev) => ({
            ...prev,
            [currentQuestion.soal_id]: answer,
        }));
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex((prev) => prev - 1);
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        }
    };

    const handleQuestionJump = (index: number) => {
        setCurrentQuestionIndex(index);
        setMobileNavOpen(false);
    };

    const getTimeColor = () => {
        if (timeRemaining <= 60) return 'bg-red-500';
        if (timeRemaining <= 300) return 'bg-amber-500';
        return 'bg-cyan-500';
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
                        Kembali
                    </button>
                </div>
            </div>
        );
    }

    if (autoSubmitting) {
        const isCheating = autoSubmitReason === 'cheating';
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                    <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isCheating ? 'bg-red-100' : 'bg-amber-100'}`}>
                        {isCheating ? <ShieldAlert className="h-8 w-8 text-red-600" /> : <AlertTriangle className="h-8 w-8 text-amber-500" />}
                    </div>
                    <h1 className="mb-4 text-2xl font-bold text-gray-800">{isCheating ? 'Kecurangan terdeteksi' : 'Waktu Habis!'}</h1>
                    <p className="mb-6 text-sm text-gray-500">
                        {isCheating
                            ? 'Anda meninggalkan halaman kuis lebih dari yang diperbolehkan. Jawaban dikumpulkan otomatis dan dinilai sesuai jawaban yang sudah ada.'
                            : 'Jawaban Anda sedang dikumpulkan secara otomatis...'}
                    </p>
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-400"></div>
                </div>
            </div>
        );
    }

    const sidebarInner = (
        <>
            <div className="mb-4">
                <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">NAMA LENGKAP:</p>
                <h3 className="text-lg font-bold text-gray-800">{participant?.nama_siswa || 'Siswa'}</h3>
            </div>

            <div className="mb-6">
                <p className="mb-3 text-sm font-medium text-gray-700">Navigasi Soal</p>
                <div className="grid grid-cols-6 gap-2">
                    {shuffledQuestions.map((q, index) => {
                        const isAnswered = answers[q.soal_id] !== undefined && answers[q.soal_id] !== '';
                        const isCurrent = index === currentQuestionIndex;

                        return (
                            <button
                                key={q.soal_id}
                                type="button"
                                onClick={() => handleQuestionJump(index)}
                                className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${isCurrent ? 'bg-cyan-400 text-white' : isAnswered ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {index + 1}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <p className="mb-3 text-xs font-medium text-gray-500">Keterangan:</p>
                <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-cyan-400" />
                        <span className="text-gray-600">Soal saat ini</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-cyan-100" />
                        <span className="text-gray-600">Sudah dijawab</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-gray-100" />
                        <span className="text-gray-600">Belum dijawab</span>
                    </div>
                </div>
            </div>

            <button type="button" onClick={() => setShowConfirmSubmit(true)} disabled={submitting} className="w-full rounded-full bg-cyan-400 py-3 font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50">
                Kumpulkan
            </button>

            <div className="mt-4 text-center text-sm text-gray-500">
                {answeredCount} dari {totalQuestions} soal terjawab
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <header className="sticky top-0 z-30 border-b border-gray-100 bg-white">
                <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-red-500 sm:text-xs">SEMANGAT!!</p>
                            <h1 className="line-clamp-2 text-base font-bold text-gray-800 sm:text-lg lg:text-xl">{quiz?.judul || 'Ulangan Harian'}</h1>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-end lg:gap-4">
                            {saveStatus ? (
                                <span
                                    className={`order-3 text-[10px] sm:order-none sm:text-xs ${saveStatus === 'saved' ? 'text-emerald-500' : saveStatus === 'saving' ? 'text-gray-400' : 'text-red-500'}`}
                                >
                                    {saveStatus === 'saved' ? 'Tersimpan' : saveStatus === 'saving' ? 'Menyimpan...' : 'Gagal menyimpan'}
                                </span>
                            ) : null}

                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 lg:hidden"
                                onClick={() => setMobileNavOpen(true)}
                            >
                                <ListChecks className="h-4 w-4 text-cyan-500" aria-hidden />
                                Nav ({currentQuestionIndex + 1}/{totalQuestions || 1})
                            </button>

                            <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-white transition-colors ${getTimeColor()} sm:px-5 sm:py-2.5`}>
                                <Clock className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                                <span className="font-bold tabular-nums">{formatTime(timeRemaining)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <MobileQuizDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Navigasi soal">
                {sidebarInner}
            </MobileQuizDrawer>

            <div className="mx-auto mt-6 max-w-7xl overflow-x-hidden px-4 pb-8 sm:mt-8 sm:px-6">
                <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:gap-8">
                    <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
                        {currentQuestion ? (
                            <>
                                <div className="mb-6 min-w-0">
                                    <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <h2 className="text-lg font-bold text-gray-800">Soal {currentQuestionIndex + 1}.</h2>
                                        <span className="text-xs text-gray-400 uppercase tracking-wider px-3 py-1 bg-gray-100 rounded-full">
                                            {currentQuestion.tipe_soal === 'pilihan_ganda'
                                                ? 'Pilihan Ganda'
                                                : currentQuestion.tipe_soal === 'isian_singkat'
                                                    ? 'Isian Singkat'
                                                    : 'Uraian'}
                                        </span>
                                    </div>
                                    <div className="break-words text-gray-700 leading-relaxed">{formatText(currentQuestion.teks_soal)}</div>
                                </div>

                                {currentQuestion.tipe_soal === 'pilihan_ganda' && currentQuestion.pilihan && (
                                    <div className="space-y-4 mb-8">
                                        {currentQuestion.pilihan.map((option, index) => {
                                            const label = String.fromCharCode(65 + index);
                                            const isSelected = answers[currentQuestion.soal_id] === option.teks_pilihan;

                                            return (
                                                <button
                                                    key={option.pilihan_id}
                                                    onClick={() => handleAnswerSelect(option.teks_pilihan)}
                                                    className={`flex w-full min-w-0 items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${isSelected ? 'border-cyan-400 bg-cyan-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                                                >
                                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isSelected ? 'bg-cyan-400 text-white' : 'bg-cyan-400 text-white'}`}>{label}</div>
                                                    <span className="min-w-0 break-words font-medium text-gray-700">{option.teks_pilihan}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {(currentQuestion.tipe_soal === 'uraian' || currentQuestion.tipe_soal === 'isian_singkat') && (
                                    <div className="mb-8">
                                        <textarea
                                            value={answers[currentQuestion.soal_id] || ''}
                                            onChange={(e) => handleAnswerSelect(e.target.value)}
                                            rows={currentQuestion.tipe_soal === 'isian_singkat' ? 4 : 8}
                                            placeholder={
                                                currentQuestion.tipe_soal === 'isian_singkat'
                                                    ? 'Tulis jawaban singkat Anda...'
                                                    : 'Tulis jawaban Anda di sini dengan lengkap dan jelas...'
                                            }
                                            className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent resize-none"
                                        />
                                        <p className="text-xs text-gray-400 mt-2">{(answers[currentQuestion.soal_id] || '').length} karakter</p>
                                    </div>
                                )}

                                <div className="mt-8 flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                                    <button
                                        type="button"
                                        onClick={handlePrevious}
                                        disabled={currentQuestionIndex === 0}
                                        className="min-h-[44px] rounded-full bg-red-400 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-8 sm:py-3"
                                    >
                                        Sebelumnya
                                    </button>
                                    {currentQuestionIndex === totalQuestions - 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmSubmit(true)}
                                            disabled={submitting}
                                            className="min-h-[44px] rounded-full bg-cyan-400 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-8 sm:py-3"
                                        >
                                            Kumpulkan
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleNext}
                                            className="min-h-[44px] rounded-full bg-cyan-400 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-8 sm:py-3"
                                        >
                                            Selanjutnya
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12 text-gray-500">Tidak ada soal tersedia</div>
                        )}
                    </div>

                    <aside className="hidden h-fit min-w-[280px] lg:sticky lg:top-[5.25rem] lg:block">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">{sidebarInner}</div>
                    </aside>
                </div>
            </div>

            {tabLeaveWarningModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                            <AlertTriangle className="h-7 w-7 text-amber-600" />
                        </div>
                        <h2 className="mb-2 text-center text-xl font-bold text-gray-800">Jangan tinggalkan halaman kuis</h2>
                        <p className="mb-4 text-center text-sm text-gray-600">
                            Anda terdeteksi membuka tab lain atau meninggalkan halaman ini sebelum mengumpulkan jawaban. Tetap fokus pada jendela kuis sampai selesai.
                        </p>
                        <p className="mb-6 text-center text-sm font-semibold text-red-600">Peringatan {tabLeaveWarningModal.strike} dari 3</p>
                        <button
                            type="button"
                            onClick={() => setTabLeaveWarningModal(null)}
                            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            Saya mengerti
                        </button>
                    </div>
                </div>
            )}

            {showConfirmSubmit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Konfirmasi Pengumpulan</h2>
                        <p className="text-gray-600 text-center mb-2">
                            Anda telah menjawab {answeredCount} dari {totalQuestions} soal.
                        </p>
                        {answeredCount < totalQuestions && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                <p className="text-amber-700 text-sm text-center flex items-center justify-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Masih ada {totalQuestions - answeredCount} soal yang belum dijawab!
                                </p>
                            </div>
                        )}
                        <p className="text-gray-600 text-center mb-6">Apakah Anda yakin ingin mengumpulkan jawaban?</p>

                        <div className="flex gap-4">
                            <button onClick={() => setShowConfirmSubmit(false)} disabled={submitting} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-full transition-colors disabled:opacity-50">
                                Batal
                            </button>
                            <button onClick={() => handleSubmit()} disabled={submitting} className="flex-1 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50">
                                {submitting ? 'Mengumpulkan...' : 'Ya, Kumpulkan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
