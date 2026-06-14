import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isEssayUraian, normalizeAnswer, parseKunciJawaban } from '@/lib/quiz/kunci-jawaban';
import { computeOngoingSessionRemainingSeconds } from '@/lib/quiz/student-session';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

type GeminiShortResult = {
    nilai: 0 | 0.5 | 1;
    keterangan: string;
    jawaban_benar: string;
    penjelasan: string;
};

async function gradeIsianSingkatWithGemini(kunci: string, jawabanUser: string): Promise<{ result: GeminiShortResult | null; usedFallback: boolean }> {
    const trimmedUser = (jawabanUser || '').trim();
    if (!trimmedUser) {
        return {
            result: {
                nilai: 0,
                keterangan: 'Jawaban kosong',
                jawaban_benar: kunci,
                penjelasan: '',
            },
            usedFallback: false,
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const exact = normalizeAnswer(trimmedUser) === normalizeAnswer(kunci);
        return {
            result: {
                nilai: exact ? 1 : 0,
                keterangan: exact ? 'Jawaban tepat (kecocokan persis)' : 'Jawaban salah (GEMINI_API_KEY tidak diset)',
                jawaban_benar: kunci,
                penjelasan: '',
            },
            usedFallback: true,
        };
    }

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' },
        });

        const prompt = `Jawaban Benar: ${kunci}
Jawaban Pengguna: ${jawabanUser}

SCORING RULES:
- Normalize both answers: lowercase, trim whitespace
- If exact match → score 1
- If synonym or same meaning → score 1
- If similar but imprecise → score 0.5
- If wrong → score 0

Output format (JSON only, no extra text):
{
  "nilai": 0 | 0.5 | 1,
  "keterangan": "<brief explanation in Indonesian>",
  "jawaban_benar": "<correct answer key>",
  "penjelasan": "<short explanation of the correct answer>"
}`;

        const geminiResponse = await model.generateContent(prompt);
        let textResult = geminiResponse.response.text().trim();
        textResult = textResult.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        const grading = JSON.parse(textResult) as Partial<GeminiShortResult>;
        const nilai = grading.nilai;
        const validNilai = nilai === 0 || nilai === 0.5 || nilai === 1 ? nilai : null;
        if (validNilai === null) {
            throw new Error('Invalid nilai from model');
        }

        return {
            result: {
                nilai: validNilai,
                keterangan: grading.keterangan || '',
                jawaban_benar: (grading.jawaban_benar || kunci).trim(),
                penjelasan: (grading.penjelasan || '').trim(),
            },
            usedFallback: false,
        };
    } catch (error) {
        console.error('Isian singkat Gemini grading error:', error);
        const exact = normalizeAnswer(trimmedUser) === normalizeAnswer(kunci);
        return {
            result: {
                nilai: exact ? 1 : 0,
                keterangan: exact ? 'Jawaban tepat (dinilai dengan kecocokan persis; layanan AI tidak tersedia)' : 'Jawaban salah (dinilai dengan kecocokan persis; layanan AI tidak tersedia)',
                jawaban_benar: kunci,
                penjelasan: '',
            },
            usedFallback: true,
        };
    }
}

function scoreEssayUraian(studentAnswer: string, kunci: string): { points: number; isCorrect: boolean } {
    if (!studentAnswer || !studentAnswer.trim()) {
        return { points: 0, isCorrect: false };
    }
    if (normalizeAnswer(studentAnswer) === normalizeAnswer(kunci)) {
        return { points: 10, isCorrect: true };
    }
    return { points: 0, isCorrect: false };
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

        const body = await request.json();
        const { pesertaId, answers } = body;
        if (!pesertaId || !answers) {
            return NextResponse.json({ error: 'pesertaId dan answers wajib diisi' }, { status: 400 });
        }

        const { data: pesertaExists, error: pesertaError } = await supabase
            .from('peserta_kuis')
            .select('peserta_id, nama_siswa, status, kuis_id')
            .eq('peserta_id', pesertaId)
            .eq('kuis_id', quizIdInt)
            .maybeSingle();
        if (pesertaError || !pesertaExists) {
            return NextResponse.json({ error: 'Peserta tidak ditemukan untuk kuis ini' }, { status: 404 });
        }

        if (pesertaExists.status === 'selesai') {
            const { data: existingHasil } = await supabase.from('hasil_kuis').select('nilai, status_lulus, status_remedial, durasi_pengerjaan').eq('peserta_id', pesertaId).maybeSingle();
            return NextResponse.json({
                success: true,
                alreadySubmitted: true,
                result: { pesertaId, nilai: existingHasil?.nilai || 0, statusRemedial: existingHasil?.status_remedial || false, durasiPengerjaan: existingHasil?.durasi_pengerjaan || 0 },
                weakAnswers: [],
            });
        }

        console.log('Processing submission for:', pesertaExists.nama_siswa);

        const { data: quiz, error: quizError } = await supabase
            .from('kuis')
            .select('kuis_id, tingkat_kesulitan, kkm, status, durasi_menit, waktu_mulai_sesi, updated_at')
            .eq('kuis_id', quizIdInt)
            .single();
        if (quizError || !quiz) {
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }

        if (quiz.status !== 'ongoing') {
            return NextResponse.json({ error: 'Kuis tidak sedang berlangsung' }, { status: 400 });
        }

        const sessionRemaining = computeOngoingSessionRemainingSeconds({
            durasi_menit: quiz.durasi_menit,
            waktu_mulai_sesi: quiz.waktu_mulai_sesi,
            updated_at: quiz.updated_at,
        });
        if (sessionRemaining < -120) {
            return NextResponse.json({ error: 'Sesi kuis sudah terlalu lama berakhir. Tidak dapat mengumpulkan jawaban.' }, { status: 400 });
        }

        const { data: questions, error: questionsError } = await supabase.from('soal').select('*').eq('kuis_id', quizIdInt);
        if (questionsError || !questions) {
            return NextResponse.json({ error: 'Gagal mengambil soal' }, { status: 500 });
        }

        const soalIds = questions.map((q) => q.soal_id);
        const { data: allPilihan } = await supabase.from('pilihan_jawaban').select('*').in('soal_id', soalIds);
        const { data: allKunci } = await supabase.from('kunci_jawaban').select('*').in('soal_id', soalIds);

        const pilihanMap = new Map<number, any[]>();
        (allPilihan || []).forEach((p) => {
            if (!pilihanMap.has(p.soal_id)) pilihanMap.set(p.soal_id, []);
            pilihanMap.get(p.soal_id)!.push(p);
        });
        const kunciMap = new Map<number, any>();
        (allKunci || []).forEach((k) => kunciMap.set(k.soal_id, k));

        const questionsWithDetails = questions.map((q) => ({
            ...q,
            pilihan_jawaban: pilihanMap.get(q.soal_id) || [],
            kunci_jawaban: kunciMap.get(q.soal_id) || null,
        }));

        const submitTime = new Date();
        let totalScore = 0;
        let totalPossiblePoints = 0;
        let correctCount = 0;
        let incorrectCount = 0;

        const jawabanRecords: any[] = [];
        const weakAnswers: any[] = [];
        let anyAiGradingFallback = false;

        for (const question of questionsWithDetails) {
            const studentAnswer = answers[question.soal_id];
            const maxPoinSoal = 10;
            totalPossiblePoints += maxPoinSoal;

            let isCorrect = false;
            let pointsEarned = 0;
            let correctAnswerText = '';

            if (question.tipe_soal === 'pilihan_ganda') {
                const correctOption = question.pilihan_jawaban?.find((p: any) => p.is_benar);
                correctAnswerText = correctOption?.teks_pilihan || '';

                if (studentAnswer && studentAnswer === correctAnswerText) {
                    isCorrect = true;
                    pointsEarned = 10;
                    correctCount++;
                } else {
                    incorrectCount++;
                    pointsEarned = 0;
                }

                if (!isCorrect) {
                    weakAnswers.push({
                        teks_soal: question.teks_soal,
                        jawaban_siswa: studentAnswer || '',
                        jawaban_benar: correctAnswerText,
                        konsep: question.kunci_jawaban?.jawaban_text || '',
                    });
                }
            } else {
                const kunciRow = question.kunci_jawaban;
                const rawKey = kunciRow?.jawaban_text || '';
                const parsed = parseKunciJawaban(rawKey);
                const essay = isEssayUraian(question.tipe_soal, rawKey);
                const useGeminiShort =
                    question.tipe_soal === 'isian_singkat' || (question.tipe_soal === 'uraian' && !essay);

                if (useGeminiShort) {
                    const keyForCompare = parsed.kunci || rawKey;
                    correctAnswerText = keyForCompare;

                    if (!studentAnswer || String(studentAnswer).trim() === '') {
                        pointsEarned = 0;
                        incorrectCount++;
                    } else {
                        const { result: grading, usedFallback } = await gradeIsianSingkatWithGemini(keyForCompare, String(studentAnswer));
                        if (usedFallback) anyAiGradingFallback = true;
                        if (!grading) {
                            pointsEarned = 0;
                            incorrectCount++;
                        } else {
                            pointsEarned = Number((grading.nilai * 10).toFixed(2));
                            if (grading.nilai === 1) {
                                correctCount++;
                                isCorrect = true;
                            } else {
                                incorrectCount++;
                                if (grading.nilai === 0) {
                                    weakAnswers.push({
                                        teks_soal: question.teks_soal,
                                        jawaban_siswa: studentAnswer,
                                        jawaban_benar: grading.jawaban_benar || keyForCompare,
                                        konsep: grading.penjelasan || '',
                                    });
                                }
                            }
                        }
                    }
                } else {
                    const keyForEssay = parsed.kunci || rawKey;
                    correctAnswerText = keyForEssay;
                    const scored = scoreEssayUraian(String(studentAnswer || ''), keyForEssay);
                    pointsEarned = scored.points;
                    isCorrect = scored.isCorrect;
                    if (isCorrect) correctCount++;
                    else incorrectCount++;
                    if (!isCorrect) {
                        weakAnswers.push({
                            teks_soal: question.teks_soal,
                            jawaban_siswa: studentAnswer || '',
                            jawaban_benar: keyForEssay,
                            konsep: parsed.penjelasan || kunciRow?.jawaban_text || '',
                        });
                    }
                }
            }

            totalScore += pointsEarned;
            jawabanRecords.push({
                peserta_id: pesertaId,
                soal_id: question.soal_id,
                jawaban: studentAnswer || '',
                is_benar: isCorrect,
                waktu_jawab: submitTime.toISOString(),
                poin_dapat: pointsEarned,
            });
        }

        let finalScore = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
        finalScore = Math.min(100, Math.max(0, finalScore));
        finalScore = Number(finalScore.toFixed(2));

        console.log('📝 Jawaban records to save:', jawabanRecords.length);
        console.log('📊 Total score:', totalScore, 'from', totalPossiblePoints);

        await supabase.from('jawaban_siswa').delete().eq('peserta_id', pesertaId);

        const { error: jawabanError } = await supabase.from('jawaban_siswa').insert(jawabanRecords);

        if (jawabanError) {
            console.error('Save answers error:', jawabanError);
        } else {
            console.log('Jawaban berhasil disimpan:', jawabanRecords.length, 'records');
        }

        const { data: hasilExisting } = await supabase.from('hasil_kuis').select('waktu_mulai').eq('peserta_id', pesertaId).maybeSingle();

        let waktuMulaiStr = hasilExisting?.waktu_mulai;
        if (waktuMulaiStr && !waktuMulaiStr.endsWith('Z') && !waktuMulaiStr.includes('+')) {
            waktuMulaiStr += 'Z';
        }
        const waktuMulai = waktuMulaiStr ? new Date(waktuMulaiStr) : submitTime;
        const durasiPengerjaan = Math.max(0, Math.round((submitTime.getTime() - waktuMulai.getTime()) / 1000));

        const { error: hasilError } = await supabase.from('hasil_kuis').update({
            nilai: finalScore,
            status_lulus: finalScore >= (quiz.kkm || 70),
            status_remedial: finalScore < (quiz.kkm || 70),
            waktu_selesai: submitTime.toISOString(),
            durasi_pengerjaan: durasiPengerjaan,
        }).eq('peserta_id', pesertaId);

        if (hasilError) {
            console.error('Update hasil_kuis error:', hasilError);
        }

        const { error: pesertaUpdateError } = await supabase.from('peserta_kuis').update({ status: 'selesai' }).eq('peserta_id', pesertaId);

        if (pesertaUpdateError) {
            console.error('Update peserta status error:', pesertaUpdateError);
        }

        return NextResponse.json({
            success: true,
            result: {
                pesertaId,
                nilai: finalScore,
                correctCount,
                incorrectCount,
                totalQuestions: questions.length,
                statusRemedial: finalScore < (quiz.kkm || 70),
                durasiPengerjaan,
            },
            weakAnswers,
            aiGradingFallback: anyAiGradingFallback,
            aiGradingFallbackNote: anyAiGradingFallback
                ? 'Beberapa jawaban isian singkat dinilai dengan kecocokan persis karena penilaian AI tidak tersedia atau gagal.'
                : undefined,
        });
    } catch (error: any) {
        console.error('Submit quiz error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}
