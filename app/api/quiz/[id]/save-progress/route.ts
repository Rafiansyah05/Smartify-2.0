import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { assertActiveQrForQuiz } from '@/lib/quiz/student-session';

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
        if (!quizId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        const body = await request.json();
        const { pesertaId, answers, token } = body;
        const quizIdInt = parseInt(String(quizId), 10);
        if (Number.isNaN(quizIdInt)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        if (!pesertaId || !answers || !token || typeof token !== 'string' || !String(token).trim()) {
            return NextResponse.json({ error: 'Data tidak lengkap (perlu token QR dari link ruang tunggu)' }, { status: 400 });
        }

        try {
            await assertActiveQrForQuiz(supabase, quizIdInt, String(token).trim());
        } catch (e: any) {
            return NextResponse.json({ error: e.message || 'Token tidak valid' }, { status: 403 });
        }

        const { data: pesertaRow, error: pesertaErr } = await supabase
            .from('peserta_kuis')
            .select('peserta_id')
            .eq('peserta_id', pesertaId)
            .eq('kuis_id', quizIdInt)
            .maybeSingle();

        if (pesertaErr || !pesertaRow) {
            return NextResponse.json({ error: 'Peserta tidak valid untuk kuis ini' }, { status: 403 });
        }

        const records: any[] = [];
        const submitTime = new Date().toISOString();

        const soalIds = Object.keys(answers).map(id => parseInt(id)).filter(id => !isNaN(id));

        let correctMap = new Map();
        if (soalIds.length > 0) {
            const { data: pilihanBenar } = await supabase
                .from('pilihan_jawaban')
                .select('soal_id, teks_pilihan')
                .in('soal_id', soalIds)
                .eq('is_benar', true);

            pilihanBenar?.forEach(p => correctMap.set(Number(p.soal_id), p.teks_pilihan));
        }

        for (const [soalIdStr, jawaban] of Object.entries(answers)) {
            const soalId = parseInt(soalIdStr);
            const kunci = correctMap.get(soalId);
            let isBenar = false;
            let poinDapat = 0;

            if (kunci && typeof jawaban === 'string' && jawaban.trim().toLowerCase() === kunci.trim().toLowerCase()) {
                isBenar = true;
                poinDapat = 10;
            }

            records.push({
                peserta_id: pesertaId,
                soal_id: soalId,
                jawaban: jawaban || '',
                is_benar: isBenar,
                poin_dapat: poinDapat,
                waktu_jawab: submitTime
            });
        }

        if (records.length > 0) {
            await supabase.from('jawaban_siswa').delete().eq('peserta_id', pesertaId);
            await supabase.from('jawaban_siswa').insert(records);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
