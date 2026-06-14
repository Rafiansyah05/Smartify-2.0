import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { parseKunciJawaban } from '@/lib/quiz/kunci-jawaban';

async function getParams(context: any) {
    const params = await context.params;
    const quizId = params?.id;
    const pesertaId = params?.pesertaId;

    return {
        quizId: Array.isArray(quizId) ? quizId[0] : quizId,
        pesertaId: Array.isArray(pesertaId) ? pesertaId[0] : pesertaId,
    };
}

export async function GET(request: NextRequest, context: any) {
    try {

        const { quizId, pesertaId } = await getParams(context);

        if (!quizId || !pesertaId) {
            return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
        }


        const quizIdInt = parseInt(quizId);
        if (isNaN(quizIdInt)) {
            return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
        }

        const pesertaIdInt = parseInt(pesertaId);
        if (isNaN(pesertaIdInt)) {
            return NextResponse.json({ error: 'ID peserta harus berupa angka' }, { status: 400 });
        }


        const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, judul, durasi_menit, total_soal, tingkat_kesulitan, kkm').eq('kuis_id', quizIdInt).single();

        if (quizError || !quiz) {
            console.error('Quiz not found:', quizError);
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }


        const { data: participant, error: participantError } = await supabase.from('peserta_kuis').select('peserta_id, nama_siswa, user_id, status, waktu_masuk').eq('peserta_id', pesertaIdInt).maybeSingle();

        if (participantError || !participant) {
            console.error('Participant not found:', participantError);
            return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 });
        }

        const { data: hasil, error: hasilError } = await supabase.from('hasil_kuis').select('*').eq('peserta_id', pesertaIdInt).maybeSingle();

        if (hasilError) {
            console.error('Hasil error:', hasilError);
        }


        const { data: questions, error: questionsError } = await supabase.from('soal').select('soal_id, teks_soal, tipe_soal, poin, urutan').eq('kuis_id', quizIdInt).order('urutan', { ascending: true });

        if (questionsError) {
            console.error('Questions error:', questionsError);
            return NextResponse.json({ error: 'Gagal mengambil soal' }, { status: 500 });
        }

        const questionsWithDetails = await Promise.all(
            (questions || []).map(async (q: any) => {
                const { data: pilihan } = await supabase.from('pilihan_jawaban').select('*').eq('soal_id', q.soal_id).order('urutan', { ascending: true });

                const { data: kunci } = await supabase.from('kunci_jawaban').select('*').eq('soal_id', q.soal_id).maybeSingle();

                return {
                    ...q,
                    pilihan_jawaban: pilihan || [],
                    kunci_jawaban: kunci,
                };
            }),
        );

        const { data: answers, error: answersError } = await supabase.from('jawaban_siswa').select('*').eq('peserta_id', pesertaIdInt);

        if (answersError) {
            console.error('Fetch answers error:', answersError);
        }

        const answersMap = new Map((answers || []).map((a: any) => [a.soal_id, a]));

        const questionResults = (questionsWithDetails || []).map((q: any) => {
            const studentAnswer = answersMap.get(q.soal_id);
            const correctOption = q.pilihan_jawaban?.find((p: any) => p.is_benar);
            const keyAnswer = q.kunci_jawaban;
            const rawKunci = keyAnswer?.jawaban_text || '';
            const parsed = parseKunciJawaban(rawKunci);

            let jawabanBenar: string;
            let penjelasan: string | null;
            if (q.tipe_soal === 'pilihan_ganda') {
                jawabanBenar = correctOption?.teks_pilihan || '';
                penjelasan = rawKunci || null;
            } else {
                jawabanBenar = parsed.kunci || rawKunci;
                penjelasan = parsed.penjelasan;
            }

            return {
                soal_id: q.soal_id,
                teks_soal: q.teks_soal,
                tipe_soal: q.tipe_soal,
                urutan: q.urutan,
                poin_maksimal: q.poin || 10,
                pilihan: q.pilihan_jawaban || [],
                jawaban_benar: jawabanBenar,
                penjelasan,
                jawaban_siswa: studentAnswer?.jawaban || null,
                is_benar: studentAnswer?.is_benar ?? false,
                poin_dapat: studentAnswer?.poin_dapat ?? 0,
            };
        });

        const correctCount = questionResults.filter((q) => q.is_benar).length;
        const incorrectCount = questionResults.filter((q) => !q.is_benar).length;
        const totalQuestions = questionResults.length;

        const { data: allParticipants, error: participantsError } = await supabase.from('peserta_kuis').select('peserta_id, nama_siswa').eq('kuis_id', quizIdInt);

        const { data: allHasil, error: allHasilError } = await supabase
            .from('hasil_kuis')
            .select('peserta_id, nilai')
            .in(
                'peserta_id',
                (allParticipants || []).map((p) => p.peserta_id),
            );

        const leaderboardData = (allParticipants || [])
            .map((p) => {
                const hasilRecord = (allHasil || []).find((h) => h.peserta_id === p.peserta_id);
                return {
                    peserta_id: p.peserta_id,
                    nama_siswa: p.nama_siswa,
                    nilai: hasilRecord?.nilai || 0,
                };
            })
            .sort((a, b) => b.nilai - a.nilai);

        const leaderboard = leaderboardData.map((item, index) => ({
            rank: index + 1,
            peserta_id: item.peserta_id,
            nama_siswa: item.nama_siswa,
            nilai: item.nilai,
            isCurrentUser: item.peserta_id === pesertaIdInt,
        }));

        const userRank = leaderboard.findIndex((l) => l.peserta_id === pesertaIdInt) + 1;

        return NextResponse.json({
            quiz: {
                kuis_id: quiz.kuis_id,
                judul: quiz.judul,
                durasi_menit: quiz.durasi_menit,
                total_soal: quiz.total_soal,
                kkm: quiz.kkm,
            },
            participant: {
                peserta_id: participant.peserta_id,
                nama_siswa: participant.nama_siswa,
                nilai: hasil?.nilai ?? 0,
                status_remedial: hasil?.status_remedial ?? false,
                status_lulus: hasil?.status_lulus ?? false,
                waktu_mulai: hasil?.waktu_mulai || null,
                waktu_selesai: hasil?.waktu_selesai || null,
                durasi_pengerjaan: hasil?.durasi_pengerjaan || 0,
            },
            statistics: {
                correctCount,
                incorrectCount,
                totalQuestions,
                score: hasil?.nilai ?? 0,
            },
            questionResults,
            leaderboard: leaderboard.slice(0, 10),
            userRank,
            totalParticipants: leaderboard.length,
        });
    } catch (error: any) {
        console.error('Result API error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}
