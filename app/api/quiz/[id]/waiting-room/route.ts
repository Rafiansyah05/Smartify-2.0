import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

function generateQrToken() {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
}

async function getRawQuizId(request: NextRequest, context: any) {
    const params = await context.params;
    const idFromParams = params?.id;
    if (idFromParams) {
        return Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
    }
    const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
    return pathnameParts[2] || null;
}

export async function GET(request: NextRequest, context: any) {
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
        const user = token ? await getUserFromToken(token) : null;

        const qrTokenParam = request.nextUrl.searchParams.get('token');

        const { data: quiz, error: quizError } = await supabase
            .from('kuis')
            .select('kuis_id, judul, tingkat_kesulitan, durasi_menit, total_soal, status, guru_id, kkm, created_at, waktu_mulai_sesi, updated_at')
            .eq('kuis_id', quizIdInt)
            .single();

        if (quizError || !quiz) {
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }

        const { data: qrCodes } = await supabase.from('qr_codes').select('qr_id, qr_token, qr_image_url, is_active, created_at').eq('kuis_id', quizIdInt).eq('is_active', true).order('created_at', { ascending: false }).limit(1);

        const { data: participants } = await supabase.from('peserta_kuis').select('peserta_id, kuis_id, user_id, nama_siswa, status, waktu_masuk').eq('kuis_id', quizIdInt).order('waktu_masuk', { ascending: true });

        let joinedParticipant = null;
        if (qrTokenParam && !user) {
            joinedParticipant = null;
        }

        const qrCodeData = qrCodes?.[0]
            ? {
                ...qrCodes[0],
                qr_image_url: qrCodes[0].qr_image_url,
            }
            : null;

        return NextResponse.json({
            quiz: {
                ...quiz,
                status: quiz.status || 'draft',
            },
            qrCode: qrCodeData,
            participants: participants || [],
            joinedParticipant,
            user: user
                ? {
                    user_id: user.user_id,
                    nama: user.nama,
                    email: user.email,
                    role: user.role,
                }
                : null,
        });
    } catch (error: any) {
        console.error('Waiting room GET error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, context: any) {
    try {
        const token = request.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getUserFromToken(token);
        if (!user || (user.role !== 'guru' && user.role !== 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - hanya guru yang dapat mengakses' }, { status: 401 });
        }

        const quizId = await getRawQuizId(request, context);
        if (!quizId) {
            return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
        }

        const quizIdInt = parseInt(quizId);
        if (isNaN(quizIdInt)) {
            return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
        }

        const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, judul, status, guru_id').eq('kuis_id', quizIdInt).single();

        if (quizError || !quiz) {
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }

        if (quiz.guru_id !== user.user_id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengelola ruang tunggu kuis ini' }, { status: 403 });
        }

        await supabase.from('qr_codes').update({ is_active: false }).eq('kuis_id', quizIdInt).eq('is_active', true);

        const qrToken = generateQrToken();
        const qrPath = `/quiz/${quizIdInt}/waiting-room?token=${qrToken}`;

        const { data: qrData, error: qrError } = await supabase
            .from('qr_codes')
            .insert({
                kuis_id: quizIdInt,
                qr_token: qrToken,
                qr_image_url: qrPath,
                is_active: true,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (qrError) {
            console.error('QR insert error:', qrError);
            return NextResponse.json({ error: 'Gagal membuat QR Code' }, { status: 500 });
        }

        await supabase
            .from('kuis')
            .update({
                status: 'waiting',
                updated_at: new Date().toISOString(),
                waktu_mulai_sesi: null,
            })
            .eq('kuis_id', quizIdInt);

        return NextResponse.json({
            success: true,
            qrCode: {
                ...qrData,
                qr_image_url: qrPath,
            },
            quiz: {
                ...quiz,
                status: 'waiting',
            },
        });
    } catch (error: any) {
        console.error('Waiting room POST error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}
