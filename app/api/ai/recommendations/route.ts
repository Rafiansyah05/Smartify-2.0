import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { weakAnswers, quizTitle } = await request.json();

        if (!weakAnswers || weakAnswers.length === 0) {
            return NextResponse.json({ recommendations: [] });
        }
        const weakQuestionsText = weakAnswers
            .map((item: any, idx: number) => {
                return `${idx + 1}. Soal: ${item.teks_soal}\n   Jawaban Siswa: ${item.jawaban_siswa}\n   Jawaban Benar: ${item.jawaban_benar}\n   Konsep yang terkait: ${item.konsep || 'Tidak disebutkan'}`;
            })
            .join('\n\n');

        const prompt = `Anda adalah asisten AI yang membantu siswa belajar. Berdasarkan hasil quiz "${quizTitle}", siswa menjawab salah pada soal-soal berikut:

${weakQuestionsText}

Tugas Anda:
1. Identifikasi TOPIK/MATERI utama yang belum dikuasai siswa dari soal-soal tersebut (maksimal 3 topik)
2. Berikan rekomendasi belajar yang spesifik untuk setiap topik

Format response HARUS berupa JSON murni (raw JSON) dengan array of objects:
[
  {
    "materi": "nama materi/topik",
    "rekomendasi": "penjelasan singkat tentang materi ini dan saran belajar yang spesifik (maksimal 2 kalimat)"
  }
]

Gunakan bahasa Indonesia yang santai namun informatif. Jangan menggunakan block markdown seperti \`\`\`json.`;

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        const textResult = result.response.text();

        const recommendations = JSON.parse(textResult);

        return NextResponse.json({ recommendations });
    } catch (error: any) {
        console.error('AI Recommendation Error:', error);
        return NextResponse.json({ recommendations: [], error: error.message }, { status: 500 });
    }
}
