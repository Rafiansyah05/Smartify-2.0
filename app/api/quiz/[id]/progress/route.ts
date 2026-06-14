import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

async function getRawQuizId(request: NextRequest, context: any) {
    const params = await context.params;
    return params?.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : null;
}

export async function GET(request: NextRequest, context: any) {
    try {
        const quizId = await getRawQuizId(request, context);
        if (!quizId) return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
        const quizIdInt = parseInt(quizId);
        if (isNaN(quizIdInt)) return NextResponse.json({ error: 'ID kuis harus angka' }, { status: 400 });

        const token = request.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await getUserFromToken(token);
        if (!user || (user.role !== 'guru' && user.role !== 'admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: quiz, error: quizError } = await supabase
            .from('kuis')
            .select('kuis_id, judul, durasi_menit, total_soal, status, tingkat_kesulitan, kkm, created_at, updated_at, guru_id, waktu_mulai_sesi')
            .eq('kuis_id', quizIdInt)
            .single();
        if (quizError || !quiz) return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });

        if (quiz.guru_id !== user.user_id) {
            return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
        }

        const { count: totalQuestions } = await supabase.from('soal').select('soal_id', { count: 'exact', head: true }).eq('kuis_id', quizIdInt);

        const { data: participants } = await supabase.from('peserta_kuis').select('peserta_id, nama_siswa, status, waktu_masuk').eq('kuis_id', quizIdInt);

        if (!participants || participants.length === 0) {
            return NextResponse.json({
                quiz: { ...quiz, total_questions: totalQuestions || 0 },
                participants: [],
                statistics: {
                    totalParticipants: 0,
                    completedCount: 0,
                    inProgressCount: 0,
                    avgScore: 0,
                    highestScore: 0,
                    lowestScore: 0,
                    passedCount: 0,
                    failedCount: 0,
                },
            });
        }

        const pesertaIds = participants.map((p) => p.peserta_id);

        const { data: hasilList } = await supabase.from('hasil_kuis').select('*').in('peserta_id', pesertaIds);
        const hasilMap = new Map(hasilList?.map((h) => [h.peserta_id, h]) || []);

        const { data: jawabanList } = await supabase.from('jawaban_siswa').select('peserta_id, poin_dapat').in('peserta_id', pesertaIds);
        const jawabanCountMap = new Map();
        const pointsMap = new Map();

        jawabanList?.forEach((j) => {
            jawabanCountMap.set(j.peserta_id, (jawabanCountMap.get(j.peserta_id) || 0) + 1);
            pointsMap.set(j.peserta_id, (pointsMap.get(j.peserta_id) || 0) + (j.poin_dapat || 0));
        });

        const maxPoints = (totalQuestions || 1) * 10;

        const processed = participants.map((p) => {
            const hasil = hasilMap.get(p.peserta_id);
            const answered = jawabanCountMap.get(p.peserta_id) || 0;
            const earnedPoints = pointsMap.get(p.peserta_id) || 0;

            const status = p.status || 'waiting';

            let nilai = 0;
            if (status === 'selesai') {
                nilai = hasil?.nilai || 0;
            } else {
                nilai = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
            }

            const progressPercent = totalQuestions ? Math.round((answered / totalQuestions) * 100) : 0;

            return {
                peserta_id: p.peserta_id,
                nama_siswa: p.nama_siswa,
                status,
                waktu_masuk: p.waktu_masuk,
                nilai,
                answered_count: answered,
                total_questions: totalQuestions || 0,
                progress_percent: progressPercent,
                status_remedial: hasil?.status_remedial ?? false,
                status_lulus: hasil?.status_lulus ?? false,
                waktu_mulai: hasil?.waktu_mulai ?? null,
                waktu_selesai: hasil?.waktu_selesai ?? null,
                durasi_pengerjaan: hasil?.durasi_pengerjaan ?? 0,
            };
        });

        const sorted = processed.sort((a, b) => {
            if (a.status === 'selesai' && b.status === 'selesai') return (b.nilai || 0) - (a.nilai || 0);
            if (a.status === 'selesai') return -1;
            if (b.status === 'selesai') return 1;
            return (b.answered_count || 0) - (a.answered_count || 0);
        });

        const completed = processed.filter((p) => p.status === 'selesai');
        const quizStatus = (quiz.status as string) || '';
        const inProgress = processed.filter((p) => {
            if (p.status === 'started' || p.status === 'sedang_mengerjakan') return true;
            if (quizStatus === 'ongoing' && p.status === 'waiting') return true;
            return false;
        });
        const completedScores = completed.map((p) => p.nilai).filter((n) => n !== null);
        const avgScore = completedScores.length ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length) : 0;
        const highestScore = completedScores.length ? Math.max(...completedScores) : 0;
        const lowestScore = completedScores.length ? Math.min(...completedScores) : 0;
        const passedCount = completed.filter((p) => (p.nilai ?? 0) >= (quiz.kkm || 70)).length;
        const failedCount = completed.length - passedCount;

        return NextResponse.json({
            quiz: { ...quiz, total_questions: totalQuestions || 0 },
            participants: sorted,
            statistics: {
                totalParticipants: processed.length,
                completedCount: completed.length,
                inProgressCount: inProgress.length,
                avgScore,
                highestScore,
                lowestScore,
                passedCount,
                failedCount,
            },
        });
    } catch (error: any) {
        console.error('Progress API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
