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
        const token = request.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getUserFromToken(token);
        if (!user || (user.role !== 'guru' && user.role !== 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - hanya guru yang dapat mengeluarkan siswa' }, { status: 401 });
        }

        const quizId = await getRawQuizId(request, context);
        if (!quizId) {
            return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
        }

        const quizIdInt = parseInt(quizId);
        if (isNaN(quizIdInt)) {
            return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
        }

        const body = await request.json();
        const pesertaId = body.pesertaId;

        if (!pesertaId) {
            return NextResponse.json({ error: 'ID peserta tidak valid' }, { status: 400 });
        }

        const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, guru_id').eq('kuis_id', quizIdInt).single();
        if (quizError || !quiz) {
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }

        if (quiz.guru_id !== user.user_id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengeluarkan peserta dari kuis ini' }, { status: 403 });
        }

        const { error: deleteError } = await supabase
            .from('peserta_kuis')
            .delete()
            .eq('peserta_id', pesertaId)
            .eq('kuis_id', quizIdInt);

        if (deleteError) {
            console.error('Kick error:', deleteError);
            return NextResponse.json({ error: 'Gagal mengeluarkan peserta' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Kick route error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}
