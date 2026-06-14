import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest, context: any) {
    try {
        const { id } = context.params || {};
        let rawId = Array.isArray(id) ? id[0] : id;
        if (!rawId) {
            const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
            rawId = pathnameParts[2] || null;
        }
        if (!rawId || rawId === '') {
            return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
        }

        const quizId = /^[0-9]+$/.test(rawId) ? Number(rawId) : rawId;
        if (typeof quizId !== 'number') {
            return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
        }

        const body = await request.json();
        const name = String(body.name || '').trim();
        const token = String(body.token || '').trim();

        if (!name || !token) {
            return NextResponse.json({ error: 'Nama dan token QR diperlukan' }, { status: 400 });
        }

        const { data: kuisRow, error: kuisErr } = await supabase.from('kuis').select('kuis_id, status').eq('kuis_id', quizId).single();
        if (kuisErr || !kuisRow) {
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }

        if (kuisRow.status !== 'waiting' && kuisRow.status !== 'ongoing') {
            return NextResponse.json({ error: 'Kuis tidak dibuka untuk bergabung saat ini.' }, { status: 400 });
        }

        const { data: qrCode, error: qrError } = await supabase
            .from('qr_codes')
            .select('qr_id, qr_token, qr_image_url, is_active')
            .eq('kuis_id', quizId)
            .eq('qr_token', token)
            .eq('is_active', true)
            .single();

        if (qrError || !qrCode) {
            return NextResponse.json({ error: 'QR Code tidak valid atau sudah tidak aktif' }, { status: 404 });
        }

        const isOngoing = kuisRow.status === 'ongoing';
        const nowIso = new Date().toISOString();

        const { data: existingParticipant } = await supabase
            .from('peserta_kuis')
            .select('peserta_id, kuis_id, user_id, nama_siswa, status, waktu_masuk')
            .eq('kuis_id', quizId)
            .eq('nama_siswa', name)
            .maybeSingle();

        if (existingParticipant) {
            if (existingParticipant.status === 'selesai') {
                return NextResponse.json(
                    {
                        error: 'Nama sudah digunakan dan telah menyelesaikan kuis. Silakan gunakan nama lain.',
                    },
                    { status: 400 },
                );
            }

            if (isOngoing && existingParticipant.status === 'waiting') {
                await supabase.from('peserta_kuis').update({ status: 'started' }).eq('peserta_id', existingParticipant.peserta_id);
                await supabase
                    .from('hasil_kuis')
                    .upsert(
                        {
                            peserta_id: existingParticipant.peserta_id,
                            nilai: 0,
                            status_lulus: false,
                            status_remedial: false,
                            waktu_mulai: nowIso,
                            waktu_selesai: null,
                            durasi_pengerjaan: 0,
                        },
                        { onConflict: 'peserta_id' },
                    );
                return NextResponse.json({
                    participant: { ...existingParticipant, status: 'started' },
                    message: 'Bergabung kembali',
                    quizOngoing: true,
                });
            }

            return NextResponse.json({
                participant: existingParticipant,
                message: 'Peserta sudah bergabung',
                quizOngoing: isOngoing,
            });
        }

        const initialStatus = isOngoing ? 'started' : 'waiting';

        const { data: participantData, error: participantError } = await supabase
            .from('peserta_kuis')
            .insert({
                kuis_id: quizId,
                nama_siswa: name,
                status: initialStatus,
                waktu_masuk: nowIso,
            })
            .select()
            .single();

        if (participantError) {
            console.error('Join error:', participantError);
            return NextResponse.json({ error: 'Gagal bergabung ke ruangan' }, { status: 500 });
        }

        const { error: hasilError } = await supabase.from('hasil_kuis').upsert(
            {
                peserta_id: participantData.peserta_id,
                nilai: 0,
                status_lulus: false,
                status_remedial: false,
                waktu_mulai: nowIso,
                waktu_selesai: null,
                durasi_pengerjaan: 0,
            },
            { onConflict: 'peserta_id' },
        );

        if (hasilError) {
            console.error('Init hasil_kuis error:', hasilError);
        }

        const sessionId = Buffer.from(`${participantData.peserta_id}-${Date.now()}`).toString('base64');

        return NextResponse.json({
            participant: {
                ...participantData,
                status: initialStatus,
            },
            sessionId: sessionId,
            quizOngoing: isOngoing,
        });
    } catch (error: any) {
        console.error('Join route error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}
