import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';
import {
  FREE_MAX_GENERATES_PER_24H,
  FREE_TRIAL_MAX_QUESTIONS,
  PREMIUM_MAX_QUESTIONS,
  isPremiumEffective,
} from '@/lib/subscription/plan';
import { countGeneratesLast24Hours } from '@/lib/subscription/quota.server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const difficulty = formData.get('difficulty') as string;
    const totalQuestions = parseInt(formData.get('totalQuestions') as string);
    const duration = parseInt(formData.get('duration') as string);
    const kkm = parseInt(formData.get('kkm') as string);

    const multipleChoiceCount = parseInt(formData.get('multipleChoiceCount') as string) || 0;
    const shortAnswerCount = parseInt(formData.get('shortAnswerCount') as string) || 0;

    if (!file || !title) {
      return NextResponse.json({ error: 'File dan judul wajib diisi' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    const subscriptionStatus = (user as { subscription_status?: string | null }).subscription_status;
    const expiredAt = (user as { expired_at?: string | null }).expired_at;
    const premiumActive = isPremiumEffective(subscriptionStatus, expiredAt);

    if (!premiumActive) {
      try {
        const used24h = await countGeneratesLast24Hours(user.user_id);
        if (used24h >= FREE_MAX_GENERATES_PER_24H) {
          return NextResponse.json(
            {
              error:
                'Anda sudah mencapai batas generate untuk Free Trial (2 kali dalam 24 jam). Upgrade ke Premium untuk generate tanpa batas.',
              code: 'SUBSCRIPTION_LIMIT',
            },
            { status: 403 },
          );
        }
      } catch (quotaErr: unknown) {
        const msg = quotaErr instanceof Error ? quotaErr.message : 'Gagal memeriksa kuota';
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      if (totalQuestions > FREE_TRIAL_MAX_QUESTIONS) {
        return NextResponse.json(
          {
            error: `Free Trial dibatasi maksimal ${FREE_TRIAL_MAX_QUESTIONS} soal. Upgrade ke Premium untuk hingga ${PREMIUM_MAX_QUESTIONS} soal.`,
            code: 'SUBSCRIPTION_LIMIT',
          },
          { status: 403 },
        );
      }

      if (type !== 'pilihan_ganda') {
        return NextResponse.json(
          {
            error:
              'Free Trial hanya mendukung soal pilihan ganda. Upgrade ke Premium untuk isian singkat, campuran, dan fitur lainnya.',
            code: 'SUBSCRIPTION_LIMIT',
          },
          { status: 403 },
        );
      }
    } else if (totalQuestions > PREMIUM_MAX_QUESTIONS) {
      return NextResponse.json(
        {
          error: `Paket Premium mendukung maksimal ${PREMIUM_MAX_QUESTIONS} soal per kuis.`,
          code: 'SUBSCRIPTION_LIMIT',
        },
        { status: 403 },
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(fileBuffer).toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let pilganCount = 0;
    let isianSingkatCount = 0;

    if (type === 'pilihan_ganda') {
      pilganCount = totalQuestions;
      isianSingkatCount = 0;
    } else if (type === 'isian') {
      pilganCount = 0;
      isianSingkatCount = totalQuestions;
    } else if (type === 'campuran') {
      pilganCount = Math.max(0, multipleChoiceCount);
      isianSingkatCount = Math.max(0, shortAnswerCount);
      if (pilganCount + isianSingkatCount !== totalQuestions) {
        return NextResponse.json(
          { error: 'Jumlah pilihan ganda + isian singkat harus sama dengan total soal.' },
          { status: 400 },
        );
      }
    } else if (type === 'uraian') {
      pilganCount = 0;
      isianSingkatCount = totalQuestions;
    } else {
      pilganCount = totalQuestions;
      isianSingkatCount = 0;
    }

    const commonRules = `PENTING: 
1. JANGAN berikan teks apapun di luar JSON
2. JANGAN gunakan markdown seperti \`\`\`json
3. Langsung berikan array JSON
4. Buat kalimat soal yang profesional dan objektif secara langsung. DILARANG KERAS menggunakan kalimat pengantar seperti "Berdasarkan modul...", "Menurut materi di atas...", atau sejenisnya. Uji pemahaman konsep secara langsung layaknya soal ujian sesungguhnya.`;

    const pdfPart = {
      inlineData: {
        data: base64Data,
        mimeType: 'application/pdf',
      },
    };

    const parseGeminiQuestionArray = (raw: string, label: string): any[] => {
      let cleanJson = raw.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      const arrayMatch = cleanJson.match(/\[[\s\S]*\]/);
      if (arrayMatch) cleanJson = arrayMatch[0];
      const arr = JSON.parse(cleanJson);
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error(`${label}: respons bukan array yang valid`);
      }
      return arr;
    };

    let questionsData: any[];

    try {
      if (type === 'campuran') {
        questionsData = [];
        console.log('Campuran: generate terpisah — PG:', pilganCount, 'isian:', isianSingkatCount);

        if (pilganCount > 0) {
          const promptMc = `Anda adalah seorang guru ahli. Buat TEPAT ${pilganCount} soal PILIHAN GANDA dari dokumen (tidak kurang, tidak lebih).
Judul Kuis: ${title}
Tingkat Kesulitan: ${difficulty}

Kembalikan HANYA JSON ARRAY berisi ${pilganCount} objek. Setiap objek:
{
  "teks_soal": "...",
  "tipe_soal": "pilihan_ganda",
  "pilihan": [
    { "teks": "...", "is_benar": true },
    { "teks": "...", "is_benar": false },
    { "teks": "...", "is_benar": false },
    { "teks": "...", "is_benar": false }
  ],
  "penjelasan": "Penjelasan singkat jawaban benar"
}

${commonRules}
5. Panjang array = ${pilganCount}. Semua objek harus "pilihan_ganda".`;

          const resultMc = await model.generateContent([promptMc, pdfPart]);
          const textMc = resultMc.response.text();
          const mcArr = parseGeminiQuestionArray(textMc, 'Pilihan ganda');
          if (mcArr.length < pilganCount) {
            return NextResponse.json(
              {
                error: `Model hanya mengembalikan ${mcArr.length} soal pilihan ganda; diperlukan ${pilganCount}. Silakan coba lagi.`,
              },
              { status: 502 },
            );
          }
          questionsData.push(...mcArr.slice(0, pilganCount));
        }

        if (isianSingkatCount > 0) {
          const promptIsian = `Anda adalah seorang guru ahli. Buat TEPAT ${isianSingkatCount} soal ISIAN SINGKAT dari dokumen (tidak kurang, tidak lebih).
Judul Kuis: ${title}
Tingkat Kesulitan: ${difficulty}

Kembalikan HANYA JSON ARRAY berisi ${isianSingkatCount} objek. Setiap objek:
{
  "teks_soal": "Pertanyaan isian singkat yang jelas...",
  "tipe_soal": "isian_singkat",
  "penjelasan": "Kunci jawaban 1–3 kata"
}

${commonRules}
5. Panjang array = ${isianSingkatCount}. Setiap objek WAJIB "tipe_soal": "isian_singkat".`;

          const resultIsian = await model.generateContent([promptIsian, pdfPart]);
          const textIsian = resultIsian.response.text();
          const isianArr = parseGeminiQuestionArray(textIsian, 'Isian singkat');
          if (isianArr.length < isianSingkatCount) {
            return NextResponse.json(
              {
                error: `Model hanya mengembalikan ${isianArr.length} soal isian singkat; diperlukan ${isianSingkatCount}. Silakan coba lagi.`,
              },
              { status: 502 },
            );
          }
          questionsData.push(...isianArr.slice(0, isianSingkatCount));
        }

        console.log(`Campuran: total ${questionsData.length} soal dari Gemini (gabungan)`);
      } else {
        let prompt: string;
        if (type === 'uraian') {
          prompt = `Anda adalah seorang guru ahli. Buatlah soal URAIAN (essay) berdasarkan dokumen yang diberikan.
Judul Kuis: ${title}
Tingkat Kesulitan: ${difficulty}
Total Soal: ${totalQuestions} (semua soal uraian / essay)

Kembalikan hasil HANYA DALAM FORMAT JSON ARRAY tanpa markdown dengan skema berikut:
[
  {
    "teks_soal": "Pertanyaan essay yang memerlukan jawaban panjang dan bernalar...",
    "tipe_soal": "uraian",
    "kunci_jawaban": "Ringkasan poin-poin jawaban yang benar (kunci jawaban singkat untuk pembanding).",
    "penjelasan": "Penjelasan lengkap dan mendalam mengapa jawaban tersebut benar (beberapa kalimat hingga paragraf)."
  }
]

${commonRules}
5. Untuk setiap soal WAJIB ada "kunci_jawaban" DAN "penjelasan"; keduanya harus bermakna dan tidak kosong.`;
        } else if (type === 'isian') {
          prompt = `Anda adalah seorang guru ahli. Buatlah soal ISIAN SINGKAT berdasarkan dokumen yang diberikan.
Judul Kuis: ${title}
Tingkat Kesulitan: ${difficulty}
Total Soal: ${totalQuestions} (semua isian singkat)

Kembalikan hasil HANYA DALAM FORMAT JSON ARRAY tanpa markdown dengan skema berikut:
[
  {
    "teks_soal": "Pertanyaan isian singkat yang jelas dan spesifik...",
    "tipe_soal": "isian_singkat",
    "penjelasan": "Kunci jawaban yang sangat singkat (1 hingga 3 kata) yang langsung menjawab pertanyaan"
  }
]

${commonRules}
5. Field "penjelasan" berisi HANYA kunci jawaban singkat (1–3 kata).`;
        } else {
          prompt = `Anda adalah seorang guru ahli. Buatlah soal pilihan ganda berdasarkan dokumen yang diberikan.
Judul Kuis: ${title}
Tingkat Kesulitan: ${difficulty}
Total Soal: ${totalQuestions} (semua pilihan ganda)

Kembalikan hasil HANYA DALAM FORMAT JSON ARRAY tanpa markdown dengan skema berikut:
[
  {
    "teks_soal": "Pertanyaan soal...",
    "tipe_soal": "pilihan_ganda",
    "pilihan": [
      { "teks": "Pilihan A", "is_benar": true },
      { "teks": "Pilihan B", "is_benar": false },
      { "teks": "Pilihan C", "is_benar": false },
      { "teks": "Pilihan D", "is_benar": false }
    ],
    "penjelasan": "Penjelasan mengapa jawaban tersebut benar..."
  }
]

${commonRules}`;
        }

        console.log('Mengirim request ke Gemini dengan model gemini-2.5-flash...');
        const result = await model.generateContent([prompt, pdfPart]);
        const textResult = result.response.text();
        console.log('Response dari Gemini diterima, length:', textResult.length);
        questionsData = parseGeminiQuestionArray(textResult, 'Soal');
        console.log(`Berhasil parse ${questionsData.length} soal`);
      }
    } catch (e: any) {
      console.error('Failed to parse AI response:', e?.message);
      return NextResponse.json(
        {
          error: 'Gagal memproses respons dari AI. Silakan coba lagi.',
          detail: e?.message || String(e),
        },
        { status: 500 },
      );
    }

    const maxQuestions = Math.min(questionsData.length, totalQuestions);
    console.log(`Menyimpan ${maxQuestions} dari ${questionsData.length} soal`);

    const kodeKuis = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: kuisData, error: kuisError } = await supabase
      .from('kuis')
      .insert({
        guru_id: user.user_id,
        judul: title,
        deskripsi: 'Generated by Smartify AI',
        jenis_soal: type,
        tingkat_kesulitan: difficulty,
        durasi_menit: duration,
        kkm: kkm,
        jumlah_pilgan: pilganCount,
        jumlah_uraian: isianSingkatCount,
        total_soal: maxQuestions,
        status: 'draft',
        kode_kuis: kodeKuis,
      })
      .select()
      .single();

    if (kuisError || !kuisData) {
      console.error('Error insert kuis:', kuisError);
      return NextResponse.json({ error: 'Gagal menyimpan kuis ke database: ' + kuisError?.message }, { status: 500 });
    }

    const kuisId = kuisData.kuis_id;
    console.log(`Kuis created with ID: ${kuisId}`);

    const mapTipeSoal = (q: { tipe_soal?: string }, formType: string): 'pilihan_ganda' | 'isian_singkat' | 'uraian' => {
      const raw = String(q.tipe_soal || '')
        .toLowerCase()
        .trim();
      if (raw === 'pilihan_ganda' || raw === 'pilihan ganda') return 'pilihan_ganda';
      if (raw === 'isian_singkat' || raw === 'isian singkat') return 'isian_singkat';
      if (raw === 'uraian') {
        if (formType === 'uraian') return 'uraian';
        return 'isian_singkat';
      }
      if (formType === 'uraian') return 'uraian';
      return 'isian_singkat';
    };

    let savedCount = 0;
    for (let i = 0; i < maxQuestions; i++) {
      const q = questionsData[i];

      const tipeSoal = mapTipeSoal(q, type);
      const tipeSoalDb: 'pilihan_ganda' | 'uraian' = tipeSoal === 'isian_singkat' ? 'uraian' : tipeSoal;

      const { data: soalData, error: soalError } = await supabase
        .from('soal')
        .insert({
          kuis_id: kuisId,
          teks_soal: q.teks_soal,
          tipe_soal: tipeSoalDb,
          poin: 10,
          urutan: i + 1,
        })
        .select()
        .single();

      if (soalError) {
        console.error('Error insert soal:', soalError);
        continue;
      }

      const soalId = soalData.soal_id;

      if (tipeSoal === 'pilihan_ganda' && q.pilihan && Array.isArray(q.pilihan)) {
        const pilihanToInsert = q.pilihan.map((p: any, idx: number) => ({
          soal_id: soalId,
          teks_pilihan: p.teks.replace(/^[A-D]\.\s*/, ''), 
          is_benar: p.is_benar === true,
          urutan: idx + 1,
        }));

        const { error: pilihanError } = await supabase.from('pilihan_jawaban').insert(pilihanToInsert);
        if (pilihanError) {
          console.error('Error insert pilihan:', pilihanError);
        }

        if (q.penjelasan) {
          await supabase.from('kunci_jawaban').insert({
            soal_id: soalId,
            jawaban_text: q.penjelasan,
            kata_kunci: [],
          });
        }
        savedCount++;
      } else if (tipeSoal === 'uraian') {
        const kunci = (q as any).kunci_jawaban || (q as any).kunci || '';
        const penjelasan = (q as any).penjelasan || '';
        const jawabanText = JSON.stringify({
          kunci: String(kunci).trim() || '—',
          penjelasan: String(penjelasan).trim() || 'Penjelasan resmi belum disertakan.',
        });

        const { error: kunciError } = await supabase.from('kunci_jawaban').insert({
          soal_id: soalId,
          jawaban_text: jawabanText,
          kata_kunci: [],
        });

        if (kunciError) {
          console.error('Error insert kunci jawaban:', kunciError);
        }
        savedCount++;
      } else {
        const jawabanText = (q as any).penjelasan || (q as any).kunci || '—';

        const { error: kunciError } = await supabase.from('kunci_jawaban').insert({
          soal_id: soalId,
          jawaban_text: String(jawabanText).trim(),
          kata_kunci: [],
        });

        if (kunciError) {
          console.error('Error insert kunci jawaban:', kunciError);
        }
        savedCount++;
      }
    }

    console.log(`Success: ${savedCount} soal tersimpan dari ${maxQuestions} yang diproses`);

    return NextResponse.json({ success: true, quizId: kuisId });
  } catch (error: any) {
    console.error('API Generate Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Terjadi kesalahan pada server',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
