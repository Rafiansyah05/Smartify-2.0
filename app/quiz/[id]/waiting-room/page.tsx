'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { MoreVertical, RefreshCw, Users, User, UserMinus, Download, Link2 } from 'lucide-react';
import { Navbar } from '@/components/dashboard/Navbar';
import { supabase } from '@/lib/supabase/client';

const QR_SERVICE = 'https://api.qrserver.com/v1/create-qr-code/';

export default function WaitingRoomPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { id } = params;
    const qrToken = searchParams.get('token');

    const [quiz, setQuiz] = useState<any>(null);
    const [qrCode, setQrCode] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [joinedParticipant, setJoinedParticipant] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joinName, setJoinName] = useState('');
    const [joinError, setJoinError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [starting, setStarting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [startError, setStartError] = useState('');
    const [roomError, setRoomError] = useState('');
    const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
    const [isCheckingStorage, setIsCheckingStorage] = useState(true);

    const hasRedirectedRef = useRef(false);
    const channelRef = useRef<any>(null);
    const isQuizOwnerRef = useRef(false);
    const redirectToTakeQuizRef = useRef<() => void>(() => { });
    const fetchRoomRef = useRef<(showLoading?: boolean) => Promise<void>>(async (_showLoading = true) => { });
    const getParticipantStorageKeyRef = useRef<() => string>(() => '');
    const getWaitingRoomStorageKeyRef = useRef<() => string>(() => '');
    const routerRef = useRef(router);
    const qrTokenRef = useRef<string | null>(null);
    const idRef = useRef<string | string[] | undefined>(undefined);

    const participantEverInListRef = useRef(false);
    const kickHandledRef = useRef(false);
    const studentPesertaIdRef = useRef<number | null>(null);
    const [participantMenuId, setParticipantMenuId] = useState<number | null>(null);
    const [kickConfirm, setKickConfirm] = useState<{ id: number; name: string } | null>(null);
    const [kicking, setKicking] = useState(false);

    const isQuizOwner = useMemo(() => {
        if (!user || quiz == null) return false;
        return Number(user.user_id) === Number(quiz.guru_id);
    }, [user, quiz]);

    useEffect(() => {
        studentPesertaIdRef.current = joinedParticipant?.peserta_id ?? null;
    }, [joinedParticipant?.peserta_id]);

    useEffect(() => {
        if (!joinedParticipant?.peserta_id || isQuizOwner) return;
        if (participants.some((p) => p.peserta_id === joinedParticipant.peserta_id)) {
            participantEverInListRef.current = true;
        }
    }, [participants, joinedParticipant?.peserta_id, isQuizOwner]);

    const qrUrl = useMemo(() => {
        if (!qrCode?.qr_image_url) return null;
        return `${window.location.origin}${qrCode.qr_image_url}`;
    }, [qrCode]);

    const getParticipantStorageKey = useCallback(() => `quiz-participant-${id}`, [id]);
    const getWaitingRoomStorageKey = useCallback(() => `waiting-room-${id}-${qrToken}`, [id, qrToken]);

    useEffect(() => {
        if (isQuizOwner || !joinedParticipant?.peserta_id || loading) return;
        const me = joinedParticipant.peserta_id;
        const inList = participants.some((p) => p.peserta_id === me);
        if (inList) participantEverInListRef.current = true;
        if (participantEverInListRef.current && !inList && !kickHandledRef.current) {
            kickHandledRef.current = true;
            participantEverInListRef.current = false;
            try {
                localStorage.removeItem(getParticipantStorageKey());
                if (qrToken) localStorage.removeItem(getWaitingRoomStorageKey());
                sessionStorage.removeItem(`quiz-session-${id}`);
            } catch {
                /* ignore */
            }
            window.alert('Anda telah dikeluarkan dari ruang tunggu oleh guru.');
            router.push('/');
        }
    }, [
        participants,
        joinedParticipant,
        isQuizOwner,
        loading,
        id,
        qrToken,
        router,
        getParticipantStorageKey,
        getWaitingRoomStorageKey,
    ]);

    const saveParticipantToStorage = useCallback(
        (participantData: any) => {
            if (typeof window === 'undefined') return false;
            try {
                localStorage.setItem(getParticipantStorageKey(), JSON.stringify(participantData));
                if (qrToken) localStorage.setItem(getWaitingRoomStorageKey(), JSON.stringify(participantData));
                sessionStorage.setItem(`quiz-session-${id}`, JSON.stringify(participantData));
                return true;
            } catch (err) {
                console.error('Failed to save participant:', err);
                return false;
            }
        },
        [id, getParticipantStorageKey, getWaitingRoomStorageKey, qrToken],
    );

    const loadParticipantFromStorage = useCallback(() => {
        if (typeof window === 'undefined') return null;
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
                    if (parsed?.peserta_id) return parsed;
                }
            } catch (e) {
                console.error(e);
            }
        }
        return null;
    }, [id, getParticipantStorageKey, getWaitingRoomStorageKey]);

    const redirectToTakeQuiz = useCallback(() => {
        if (hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;

        let participantToUse = joinedParticipant;
        if (!participantToUse?.peserta_id) {
            participantToUse = loadParticipantFromStorage();
        }

        if (participantToUse?.peserta_id) {
            saveParticipantToStorage({ ...participantToUse, quizStartTime: new Date().toISOString() });
            const tokenToUse = qrToken || participantToUse.qrToken || '';
            router.push(`/quiz/${id}/take?token=${tokenToUse}`);
        } else {
            hasRedirectedRef.current = false;
        }
    }, [joinedParticipant, loadParticipantFromStorage, saveParticipantToStorage, router, id, qrToken]);

    useEffect(() => {
        if (quiz?.status === 'ongoing' && !isQuizOwner && !hasRedirectedRef.current) {
            console.log('🚀 Quiz is already ongoing, redirecting student immediately...');
            redirectToTakeQuiz();
        }
    }, [quiz?.status, isQuizOwner, redirectToTakeQuiz]);

    const fetchRoom = useCallback(
        async (showLoading = true) => {
            try {
                if (showLoading) setLoading(true);
                else setRefreshing(true);

                const url = new URL(`/api/quiz/${id}/waiting-room`, window.location.origin);
                if (qrToken) url.searchParams.set('token', qrToken);
                const res = await fetch(url.toString(), { credentials: 'include' });
                const data = await res.json();

                if (!res.ok) {
                    setRoomError(data.error || 'Gagal memuat ruang tunggu');
                    return;
                }

                setQuiz(data.quiz);
                setQrCode(data.qrCode);
                setParticipants(data.participants || []);
                setUser(data.user || null);
            } catch (err) {
                setRoomError('Terjadi kesalahan saat memuat data');
                console.error(err);
            } finally {
                if (showLoading) setLoading(false);
                else setRefreshing(false);
            }
        },
        [id, qrToken],
    );

    isQuizOwnerRef.current = isQuizOwner;
    redirectToTakeQuizRef.current = redirectToTakeQuiz;
    fetchRoomRef.current = fetchRoom;
    getParticipantStorageKeyRef.current = getParticipantStorageKey;
    getWaitingRoomStorageKeyRef.current = getWaitingRoomStorageKey;
    routerRef.current = router;
    qrTokenRef.current = qrToken;
    idRef.current = id;

    useEffect(() => {
        const saved = loadParticipantFromStorage();
        if (saved?.peserta_id) setJoinedParticipant(saved);
        setIsCheckingStorage(false);
    }, [loadParticipantFromStorage]);

    useEffect(() => {
        if (!isCheckingStorage) fetchRoom();
    }, [isCheckingStorage, fetchRoom]);

    useEffect(() => {
        if (!id || loading || isCheckingStorage) return;
        const quizIdInt = parseInt(id as string, 10);
        if (Number.isNaN(quizIdInt)) return;

        console.log('🔌 Setting up waiting room realtime for quiz:', quizIdInt);

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase.channel(`waiting-room-${quizIdInt}`);

        channel.on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'kuis',
                filter: `kuis_id=eq.${quizIdInt}`,
            },
            (payload: { new?: { status?: string } }) => {
                if (payload.new?.status === 'ongoing' && !isQuizOwnerRef.current && !hasRedirectedRef.current) {
                    console.log('🚀 Realtime DB: Quiz started, redirect siswa…');
                    redirectToTakeQuizRef.current();
                }
                void fetchRoomRef.current(false);
            },
        );

        channel.on('broadcast', { event: 'quiz_started' }, ({ payload }: { payload?: { quizId?: number } }) => {
            const qid = payload?.quizId;
            if (qid !== quizIdInt) return;
            if (!isQuizOwnerRef.current && !hasRedirectedRef.current) {
                console.log('🚀 Broadcast: Quiz started, redirect siswa…');
                redirectToTakeQuizRef.current();
            }
        });

        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'peserta_kuis', filter: `kuis_id=eq.${quizIdInt}` },
            () => void fetchRoomRef.current(false),
        );

        channel.on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'peserta_kuis', filter: `kuis_id=eq.${quizIdInt}` },
            () => void fetchRoomRef.current(false),
        );

        channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'peserta_kuis' }, (payload: any) => {
            const oldKuis = payload.old?.kuis_id as number | undefined;
            if (oldKuis != null && Number(oldKuis) !== quizIdInt) return;
            const oldId = payload.old?.peserta_id as number | undefined;
            const sessId = idRef.current;
            if (oldId && oldId === studentPesertaIdRef.current && !isQuizOwnerRef.current && !kickHandledRef.current) {
                kickHandledRef.current = true;
                participantEverInListRef.current = false;
                try {
                    localStorage.removeItem(getParticipantStorageKeyRef.current());
                    const tok = qrTokenRef.current;
                    if (tok) localStorage.removeItem(getWaitingRoomStorageKeyRef.current());
                    if (sessId) sessionStorage.removeItem(`quiz-session-${sessId}`);
                } catch {
                    /* ignore */
                }
                window.alert('Anda telah dikeluarkan dari ruang tunggu oleh guru.');
                routerRef.current.push('/');
                return;
            }
            void fetchRoomRef.current(false);
        });

        channel.subscribe((status) => {
            console.log(`📡 Waiting room realtime status:`, status);
            setIsRealtimeConnected(status === 'SUBSCRIBED');
        });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };

    }, [id, loading, isCheckingStorage]);

    const handleStartQuiz = async () => {
        if (!id) return;
        const quizIdInt = parseInt(String(id), 10);
        setStartError('');
        setStarting(true);
        try {
            const res = await fetch(`/api/quiz/${id}/start`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setStartError(data.error || 'Gagal memulai kuis');
                return;
            }

            try {
                await channelRef.current?.send({
                    type: 'broadcast',
                    event: 'quiz_started',
                    payload: { quizId: quizIdInt },
                });
            } catch (e) {
                console.warn('Broadcast quiz_started failed (siswa tetap dapat event DB):', e);
            }

            router.push(`/quiz/${id}/progress`);
        } catch (err) {
            console.error(err);
            setStartError('Terjadi kesalahan saat memulai kuis');
        } finally {
            setStarting(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinName.trim()) {
            setJoinError('Nama lengkap wajib diisi');
            return;
        }
        if (!qrToken) {
            setJoinError('Token QR tidak ditemukan');
            return;
        }
        setJoinError('');
        setSubmitting(true);
        try {
            const res = await fetch(`/api/quiz/${id}/waiting-room/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: joinName.trim(), token: qrToken }),
            });
            const data = await res.json();
            if (!res.ok) {
                setJoinError(data.error || 'Gagal bergabung ke ruangan');
                return;
            }
            const participantToStore = {
                peserta_id: data.participant.peserta_id,
                nama_siswa: data.participant.nama_siswa,
                status: data.participant.status,
                waktu_masuk: data.participant.waktu_masuk,
                savedAt: new Date().toISOString(),
                qrToken,
            };
            kickHandledRef.current = false;
            participantEverInListRef.current = true;
            setJoinedParticipant(participantToStore);
            saveParticipantToStorage(participantToStore);
            setParticipants((prev) => (prev.some((x) => x.peserta_id === data.participant.peserta_id) ? prev : [...prev, data.participant]));

            if (data.quizOngoing) {
                await fetchRoom(false);
                router.push(`/quiz/${id}/take?token=${encodeURIComponent(qrToken)}`);
                return;
            }

            await fetchRoom(false);
        } catch (err) {
            console.error(err);
            setJoinError('Terjadi kesalahan ketika bergabung');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownloadQrImage = useCallback(async () => {
        if (!qrUrl || typeof window === 'undefined') return;
        const src = `${QR_SERVICE}?size=512x512&data=${encodeURIComponent(qrUrl)}`;
        try {
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('load'));
                img.src = src;
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('ctx');
            ctx.drawImage(img, 0, 0);
            await new Promise<void>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('blob'));
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `smartify-qr-kuis-${id}.png`;
                    a.rel = 'noopener';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve();
                }, 'image/png');
            });
        } catch {
            window.open(src, '_blank', 'noopener,noreferrer');
        }
    }, [qrUrl, id]);

    const handleCopyJoinLink = useCallback(async () => {
        if (!qrUrl) return;
        try {
            await navigator.clipboard.writeText(qrUrl);
            window.alert('Link berhasil disalin. Bagikan ke siswa—buka link akan menuju halaman isi nama lengkap.');
        } catch {
            window.prompt('Salin link ini (Ctrl+C):', qrUrl);
        }
    }, [qrUrl]);

    const handleConfirmKick = async () => {
        if (!kickConfirm || !id) return;
        setKicking(true);
        try {
            const res = await fetch(`/api/quiz/${id}/waiting-room/kick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ pesertaId: kickConfirm.id }),
            });
            const data = await res.json();
            if (!res.ok) {
                window.alert(data.error || 'Gagal mengeluarkan siswa');
                return;
            }
            setKickConfirm(null);
            setParticipantMenuId(null);
            await fetchRoom(false);
        } catch {
            window.alert('Terjadi kesalahan saat mengeluarkan siswa');
        } finally {
            setKicking(false);
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty?.toLowerCase()) {
            case 'easy':
            case 'mudah':
                return 'text-emerald-500';
            case 'medium':
            case 'sedang':
                return 'text-amber-500';
            case 'hard':
            case 'sulit':
                return 'text-red-500';
            default:
                return 'text-emerald-500';
        }
    };

    const renderJoinCard = () => (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="mx-auto w-full max-w-md">
                    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10">
                        <div className="mb-6 flex flex-col items-center">
                            <Image src="/images/logo_smartify.png" alt="Smartify" width={120} height={40} priority />
                        </div>
                        <div className="mb-6 border-t border-border" />
                        <h1 className="mb-2 text-center text-2xl font-bold text-card-foreground">Masuk Ruangan</h1>
                        <p className="mb-6 text-center text-sm text-muted-foreground">Masukkan nama lengkap untuk bergabung ke kuis.</p>
                        {quiz && <p className="mb-6 text-center text-base font-semibold text-card-foreground">{quiz.judul}</p>}
                        <form onSubmit={handleJoin} className="space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="joinName" className="block text-sm font-medium text-[#3E484F]">
                                    Nama Lengkap
                                </label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                        <User className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <input
                                        id="joinName"
                                        value={joinName}
                                        onChange={(e) => setJoinName(e.target.value)}
                                        placeholder="Contoh: Budi Santoso"
                                        className="w-full rounded-xl border-0 bg-input py-3 pl-12 pr-4 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>
                            {joinError && <p className="text-sm text-red-600">{joinError}</p>}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                            >
                                {submitting ? 'Memproses...' : 'Masuk'}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );

    const renderStudentWaitingView = () => (
        <div className="min-h-screen bg-gray-50">
            <Navbar fullWidth showBackButton backButtonText="Back to Dashboard" />
            <main className="pb-16 pt-20">
                <div className="mx-auto max-w-4xl px-4 sm:px-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div className="mb-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">GENERATE QUIZ {'>'} WAITING ROOM</p>
                                    <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
                                </div>
                                <button onClick={() => fetchRoom(false)} disabled={refreshing} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                    <RefreshCw className={`w-5 h-5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            {isRealtimeConnected && (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-500 mt-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Live
                                </span>
                            )}
                        </div>

                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-cyan-500" />
                                    {participants.length} Siswa Bergabung
                                </h2>
                            </div>
                            {participants.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                    {participants.map((p) => (
                                        <div key={p.peserta_id} className="flex min-w-0 items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-800">{p.nama_siswa}</p>
                                                <span className="text-xs text-emerald-500">✓ Siap</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p>Belum ada siswa yang bergabung</p>
                                    <p className="text-xs mt-1">Bagikan QR code untuk mengundang siswa</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-cyan-50 rounded-xl p-6 text-center border border-cyan-100">
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <p className="text-cyan-800 font-medium">
                                Anda telah bergabung sebagai <strong>{joinedParticipant?.nama_siswa}</strong>
                            </p>
                            <p className="text-cyan-600 text-sm mt-2">Silakan tunggu guru memulai kuis...</p>
                            <p className="text-cyan-500 text-xs mt-1">Halaman akan otomatis berpindah saat kuis dimulai</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );

    const renderTeacherView = () => (
        <div className="min-h-screen bg-gray-50">
            <Navbar fullWidth showBackButton backButtonText="Back to Dashboard" />
            <main className="pb-16 pt-20">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
                            <div>
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">GENERATE QUIZ {'>'} WAITING ROOM</p>
                                <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
                                {isRealtimeConnected && (
                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-500 mt-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                        Live
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-wider text-gray-400">SOAL</p>
                                        <p className="text-xl font-bold text-gray-800">{quiz?.total_soal || 0}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-wider text-gray-400">WAKTU</p>
                                        <p className="text-xl font-bold text-gray-800">{quiz?.durasi_menit || 0}m</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs uppercase tracking-wider text-gray-400">LEVEL</p>
                                        <p className={`text-xl font-bold capitalize ${getDifficultyColor(quiz?.tingkat_kesulitan)}`}>{quiz?.tingkat_kesulitan || 'Medium'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleStartQuiz}
                                    disabled={starting || quiz?.status === 'ongoing'}
                                    className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {quiz?.status === 'ongoing' ? 'Kuis Berlangsung' : starting ? 'Memulai...' : 'Mulai Kuis Sekarang!'}
                                </button>
                            </div>
                        </div>
                        {startError && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{startError}</div>}
                        <div className="grid gap-8 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 sm:p-7">
                                <div className="text-center">
                                    {qrUrl ? (
                                        <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px]">
                                            <img crossOrigin="anonymous" src={`${QR_SERVICE}?size=280x280&data=${encodeURIComponent(qrUrl)}`} alt="QR Code Smartify" className="mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm" />
                                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                                <div className="rounded-full bg-white p-1.5 shadow-sm">
                                                    <Image src="/images/logo2.png" alt="Smartify" width={40} height={40} />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-56 flex items-center justify-center text-sm text-gray-400 bg-gray-100 rounded-2xl">QR Code belum tersedia</div>
                                    )}
                                    <div className="mx-auto mt-6 max-w-md space-y-4 border-t border-gray-200 pt-6 lg:max-w-none">
                                        <h3 className="text-lg font-semibold text-gray-800">Bagikan ke siswa</h3>
                                        <p className="text-pretty px-1 text-sm leading-relaxed text-gray-500">
                                            Unduh gambar QR atau salin link—sama seperti yang di dalam QR—agar siswa membuka halaman nama lengkap.
                                        </p>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-stretch">
                                            <button
                                                type="button"
                                                onClick={() => void handleDownloadQrImage()}
                                                disabled={!qrUrl}
                                                className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[160px] sm:flex-1"
                                            >
                                                <Download className="h-4 w-4 shrink-0" />
                                                Download QR
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleCopyJoinLink()}
                                                disabled={!qrUrl}
                                                className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-input disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[160px] sm:flex-1"
                                            >
                                                <Link2 className="h-4 w-4 shrink-0" />
                                                Salin link
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-cyan-500" />
                                        {participants.length} Siswa Bergabung
                                    </h2>
                                    <button onClick={() => fetchRoom(false)} disabled={refreshing} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                        <RefreshCw className={`w-5 h-5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                                {participants.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                                        {participants.map((p) => (
                                            <div key={p.peserta_id} className="relative flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3">
                                                <div className="min-w-0 flex-1 pr-2">
                                                    <p className="truncate text-sm font-medium text-gray-800">{p.nama_siswa}</p>
                                                    <span className="text-xs text-emerald-500">✓ Siap</span>
                                                </div>
                                                <div className="relative shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setParticipantMenuId(participantMenuId === p.peserta_id ? null : p.peserta_id)}
                                                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white"
                                                        aria-label="Menu siswa"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>
                                                    {participantMenuId === p.peserta_id && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="fixed inset-0 z-10 cursor-default"
                                                                aria-hidden
                                                                onClick={() => setParticipantMenuId(null)}
                                                            />
                                                            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setParticipantMenuId(null);
                                                                        setKickConfirm({ id: p.peserta_id, name: p.nama_siswa });
                                                                    }}
                                                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-gray-50"
                                                                >
                                                                    <UserMinus className="h-4 w-4" />
                                                                    Keluarkan
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">Belum ada siswa yang bergabung</p>
                                        <p className="text-sm text-gray-400 mt-1">Bagikan QR code untuk mengundang siswa</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );

    const renderAccessHintForGuests = () => (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
            <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <h1 className="mb-3 text-xl font-bold text-gray-800 sm:text-2xl">Link ruang tunggu tidak lengkap</h1>
                <p className="mb-6 text-sm leading-relaxed text-gray-500">
                    Ruang tunggu guru hanya untuk pemilik kuis. Sebagai siswa, gunakan link atau QR yang dibagikan guru (biasanya berisi token di URL).
                </p>
                <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                    Kembali ke beranda
                </button>
            </div>
        </div>
    );

    const kickModal = kickConfirm ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-card-foreground">Keluarkan siswa?</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    <strong>{kickConfirm.name}</strong> akan dikeluarkan dari ruang tunggu dan tidak dapat bergabung lagi sampai scan ulang.
                </p>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => setKickConfirm(null)}
                        disabled={kicking}
                        className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-input disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmKick}
                        disabled={kicking}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {kicking ? 'Memproses...' : 'Keluarkan'}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    if (isCheckingStorage) {
        return (
            <>
                {kickModal}
                <div className="flex min-h-screen items-center justify-center bg-gray-50">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400"></div>
                    <p className="ml-3 text-gray-500">Memeriksa sesi...</p>
                </div>
            </>
        );
    }

    if (loading && !isCheckingStorage) {
        return (
            <>
                {kickModal}
                <div className="flex min-h-screen items-center justify-center bg-gray-50">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400"></div>
                </div>
            </>
        );
    }

    if (roomError) {
        return (
            <>
                {kickModal}
                <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
                    <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                        <h1 className="mb-4 text-2xl font-bold text-gray-800">Ruangan Tidak Ditemukan</h1>
                        <p className="mb-6 text-sm text-gray-500">{roomError}</p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                            Kembali ke Dashboard
                        </button>
                    </div>
                </div>
            </>
        );
    }

    if (!isCheckingStorage && !loading && quiz && !isQuizOwner && !qrToken) {
        return (
            <>
                {kickModal}
                {renderAccessHintForGuests()}
            </>
        );
    }

    if (!isCheckingStorage) {
        if (!isQuizOwner && !joinedParticipant && qrToken) {
            return (
                <>
                    {kickModal}
                    {renderJoinCard()}
                </>
            );
        }
        if (!isQuizOwner && joinedParticipant) {
            return (
                <>
                    {kickModal}
                    {renderStudentWaitingView()}
                </>
            );
        }
    }

    return (
        <>
            {kickModal}
            {renderTeacherView()}
        </>
    );
}
