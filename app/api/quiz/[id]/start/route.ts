import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

async function getRawQuizId(request: NextRequest, context: any) {
    const params = await context.params;
    const idFromParams = params?.id;
    if (idFromParams) {
        return Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
    }
    const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
    return pathnameParts[2] || null;
}

export async function POST(request: NextRequest, context: any) {
    try {
        const quizId = await getRawQuizId(request, context);
        if (!quizId) {
            return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
        }

        const quizIdInt = parseInt(quizId);
        if (isNaN(quizIdInt)) {
            return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
        }

        const token = request.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getUserFromToken(token);
        if (!user || (user.role !== 'guru' && user.role !== 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - hanya guru yang dapat memulai kuis' }, { status: 401 });
        }

        const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, durasi_menit, judul, guru_id').eq('kuis_id', quizIdInt).single();

        if (quizError || !quiz) {
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }

        if (quiz.guru_id !== user.user_id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses untuk memulai kuis ini' }, { status: 403 });
        }

        const startTime = new Date();

        const { error: updateError } = await supabase
            .from('kuis')
            .update({
                status: 'ongoing',
                updated_at: startTime.toISOString(),
                waktu_mulai_sesi: startTime.toISOString(),
            })
            .eq('kuis_id', quizIdInt);

        if (updateError) {
            console.error('Start quiz error:', updateError);
            return NextResponse.json({ error: 'Gagal memulai kuis' }, { status: 500 });
        }

        const { data: participants, error: participantsError } = await supabase.from('peserta_kuis').select('peserta_id, user_id, nama_siswa').eq('kuis_id', quizIdInt);

        if (participantsError) {
            console.error('Fetch participants error:', participantsError);
        }

        if (participants && participants.length > 0) {
            const { error: updatePesertaError } = await supabase.from('peserta_kuis').update({ status: 'started' }).eq('kuis_id', quizIdInt);

            if (updatePesertaError) {
                console.error('Update peserta status error:', updatePesertaError);
            }


            for (const p of participants) {
                const { data: existingHasil } = await supabase.from('hasil_kuis').select('hasil_id').eq('peserta_id', p.peserta_id).maybeSingle();

                if (existingHasil) {
                    await supabase.from('hasil_kuis').update({
                        nilai: 0,
                        status_lulus: false,
                        status_remedial: false,
                        waktu_mulai: startTime.toISOString(),
                        waktu_selesai: null,
                        durasi_pengerjaan: 0,
                    }).eq('peserta_id', p.peserta_id);
                } else {
                    await supabase.from('hasil_kuis').insert({
                        peserta_id: p.peserta_id,
                        nilai: 0,
                        status_lulus: false,
                        status_remedial: false,
                        waktu_mulai: startTime.toISOString(),
                        waktu_selesai: null,
                        durasi_pengerjaan: 0,
                    });
                }
            }
        }

        console.log(`✅ Quiz ${quizIdInt} started with status 'ongoing'`);
        console.log(`📊 Total participants: ${participants?.length || 0}`);

        return NextResponse.json({
            success: true,
            startTime: startTime.toISOString(),
            duration: quiz.durasi_menit,
            totalParticipants: participants?.length || 0,
        });
    } catch (error: any) {
        console.error('Start quiz route error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}
