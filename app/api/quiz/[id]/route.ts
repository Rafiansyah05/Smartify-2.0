import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';
import {
  computeOngoingSessionRemainingSeconds,
  getPesertaForOngoingTake,
  stripKunciFromSoalList,
} from '@/lib/quiz/student-session';

function getRawQuizId(request: NextRequest, params: any) {
  const idFromParams = params?.id;
  if (idFromParams) {
    return Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
  }

  const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
  return pathnameParts[2] || null;
}

export async function GET(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const quizId = getRawQuizId(request, params);
    if (!quizId) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const quizIdInt = parseInt(quizId);
    if (isNaN(quizIdInt)) {
      return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
    }

    let token = request.cookies.get('auth_token')?.value;
    const qrToken = request.nextUrl.searchParams.get('token');

    let user = null;
    if (token) {
      user = await getUserFromToken(token);
    }

    const { data: kuis, error: kuisError } = await supabase.from('kuis').select('*').eq('kuis_id', quizIdInt).single();

    if (kuisError || !kuis) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    const isOwner = Boolean(user && user.user_id === kuis.guru_id);
    const isAdmin = Boolean(user && user.role === 'admin');

    const { data: soalList, error: soalError } = await supabase.from('soal').select('*').eq('kuis_id', quizIdInt).order('urutan', { ascending: true });

    if (soalError) throw soalError;

    const populatedSoalFull = await Promise.all(
      (soalList || []).map(async (soal) => {
        let pilihan = [];
        if (soal.tipe_soal === 'pilihan_ganda') {
          const { data: pilihanData } = await supabase.from('pilihan_jawaban').select('*').eq('soal_id', soal.soal_id).order('urutan', { ascending: true });
          pilihan = pilihanData || [];
        }

        const { data: kunciJawaban } = await supabase.from('kunci_jawaban').select('*').eq('soal_id', soal.soal_id).maybeSingle();

        return {
          ...soal,
          pilihan: pilihan,
          kunci_jawaban: kunciJawaban || null,
        };
      }),
    );

    if (isOwner || isAdmin) {
      return NextResponse.json({
        kuis,
        soal: populatedSoalFull,
        pembuat: user?.nama || 'Smartify AI',
      });
    }

    if (kuis.status === 'ongoing' && qrToken) {
      const pesertaIdRaw = request.nextUrl.searchParams.get('pesertaId');
      const pesertaId = pesertaIdRaw ? parseInt(pesertaIdRaw, 10) : NaN;
      if (!pesertaIdRaw || Number.isNaN(pesertaId)) {
        return NextResponse.json(
          {
            error: 'Silakan masuk melalui ruang tunggu dan isi nama lengkap terlebih dahulu.',
            code: 'JOIN_REQUIRED',
          },
          { status: 403 },
        );
      }

      try {
        const p = await getPesertaForOngoingTake(supabase, quizIdInt, pesertaId, qrToken);
        if (p.status === 'waiting') {
          await supabase.from('peserta_kuis').update({ status: 'started' }).eq('peserta_id', pesertaId);
        }
        if (p.status === 'selesai') {
          return NextResponse.json({ error: 'Anda sudah menyelesaikan kuis ini.' }, { status: 403 });
        }

        const timeRemainingSeconds = computeOngoingSessionRemainingSeconds({
          durasi_menit: kuis.durasi_menit,
          waktu_mulai_sesi: kuis.waktu_mulai_sesi,
          updated_at: kuis.updated_at,
        });

        if (timeRemainingSeconds <= 0) {
          return NextResponse.json({ error: 'Waktu kuis telah habis.' }, { status: 403 });
        }

        const soalStudent = stripKunciFromSoalList(populatedSoalFull);

        return NextResponse.json({
          kuis,
          soal: soalStudent,
          pembuat: user?.nama || 'Smartify AI',
          timeRemainingSeconds,
        });
      } catch (e: any) {
        const status = e?.status || 403;
        return NextResponse.json({ error: e.message || 'Akses ditolak' }, { status });
      }
    }

    if (kuis.status === 'ongoing' && !qrToken) {
      return NextResponse.json(
        { error: 'Token tidak valid. Gunakan link dari QR guru.', code: 'JOIN_REQUIRED' },
        { status: 403 },
      );
    }

    const soalPublic = stripKunciFromSoalList(populatedSoalFull);

    return NextResponse.json({
      kuis,
      soal: soalPublic,
      pembuat: user?.nama || 'Smartify AI',
    });
  } catch (error: any) {
    console.error('Fetch quiz detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const idRaw = params?.id;
    const quizId = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const quizIdInt = parseInt(quizId);
    if (isNaN(quizIdInt)) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const { data: kuis, error: kuisErr } = await supabase.from('kuis').select('kuis_id, guru_id').eq('kuis_id', quizIdInt).maybeSingle();
    if (kuisErr || !kuis) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }
    if (kuis.guru_id !== user.user_id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { data: pesertaRows } = await supabase.from('peserta_kuis').select('peserta_id').eq('kuis_id', quizIdInt);
    const pesertaIds = (pesertaRows || []).map((p) => p.peserta_id);
    if (pesertaIds.length > 0) {
      await supabase.from('jawaban_siswa').delete().in('peserta_id', pesertaIds);
      await supabase.from('hasil_kuis').delete().in('peserta_id', pesertaIds);
    }
    await supabase.from('peserta_kuis').delete().eq('kuis_id', quizIdInt);

    const { data: soalRows } = await supabase.from('soal').select('soal_id').eq('kuis_id', quizIdInt);
    const soalIds = (soalRows || []).map((s) => s.soal_id);
    if (soalIds.length > 0) {
      await supabase.from('pilihan_jawaban').delete().in('soal_id', soalIds);
      await supabase.from('kunci_jawaban').delete().in('soal_id', soalIds);
    }
    await supabase.from('soal').delete().eq('kuis_id', quizIdInt);
    await supabase.from('qr_codes').delete().eq('kuis_id', quizIdInt);
    await supabase.from('dokumen').delete().eq('kuis_id', quizIdInt);

    const { error: delKuisErr } = await supabase.from('kuis').delete().eq('kuis_id', quizIdInt);
    if (delKuisErr) {
      console.error('Delete kuis error:', delKuisErr);
      return NextResponse.json({ error: 'Gagal menghapus kuis' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE quiz error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
