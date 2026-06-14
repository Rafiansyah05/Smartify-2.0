import type { SupabaseClient } from '@supabase/supabase-js';

export async function assertActiveQrForQuiz(supabase: SupabaseClient, quizId: number, qrToken: string) {
    const { data, error } = await supabase
        .from('qr_codes')
        .select('qr_id')
        .eq('kuis_id', quizId)
        .eq('qr_token', qrToken.trim())
        .eq('is_active', true)
        .maybeSingle();

    if (error || !data) {
        const err = new Error('Token QR tidak valid atau sudah tidak aktif');
        (err as any).status = 403;
        throw err;
    }
}

export async function getPesertaForOngoingTake(
    supabase: SupabaseClient,
    quizId: number,
    pesertaId: number,
    qrToken: string,
) {
    await assertActiveQrForQuiz(supabase, quizId, qrToken);

    const { data: p, error } = await supabase
        .from('peserta_kuis')
        .select('peserta_id, kuis_id, nama_siswa, status')
        .eq('peserta_id', pesertaId)
        .eq('kuis_id', quizId)
        .maybeSingle();

    if (error || !p) {
        const err = new Error('Peserta tidak ditemukan. Daftar melalui ruang tunggu dengan nama lengkap Anda.');
        (err as any).status = 403;
        throw err;
    }

    return p;
}

export function stripKunciFromSoalList(soal: any[]) {
    return (soal || []).map((s) => {
        const { kunci_jawaban: _k, ...rest } = s;
        if (rest.pilihan && Array.isArray(rest.pilihan)) {
            rest.pilihan = rest.pilihan.map((opt: any) => {
                const { is_benar: _ib, ...o } = opt;
                return o;
            });
        }
        return rest;
    });
}

export function computeOngoingSessionRemainingSeconds(kuis: {
    durasi_menit: number | null;
    waktu_mulai_sesi?: string | null;
    updated_at?: string | null;
}) {
    const durasiMenit = kuis.durasi_menit ?? 0;
    const startIso = kuis.waktu_mulai_sesi || kuis.updated_at;
    if (!startIso) return 0;
    let s = startIso;
    if (typeof s === 'string' && !s.endsWith('Z') && !s.includes('+')) s += 'Z';
    const startMs = new Date(s).getTime();
    const endMs = startMs + durasiMenit * 60 * 1000;
    const remaining = Math.floor((endMs - Date.now()) / 1000);
    return Math.max(0, remaining);
}
