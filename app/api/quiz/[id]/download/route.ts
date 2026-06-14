import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { getUserFromToken } from '@/lib/auth/auth-service';

export async function GET(request: NextRequest, context: any) {
    try {
        const params = await context.params;
        const { id } = params;

        // Auth Check
        const token = request.cookies.get('auth_token')?.value;
        let authorName = 'Guru';
        if (token) {
            const user = await getUserFromToken(token);
            if (user) authorName = user.nama;
        }

        // Ambil data kuis
        const { data: kuis, error: kuisError } = await supabase
            .from('kuis')
            .select('*')
            .eq('kuis_id', id)
            .single();

        if (kuisError || !kuis) {
            return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
        }

        // Ambil soal
        const { data: soalList, error: soalError } = await supabase
            .from('soal')
            .select('*')
            .eq('kuis_id', id)
            .order('urutan', { ascending: true });

        if (soalError) throw soalError;

        const populatedSoal = await Promise.all(soalList.map(async (soal) => {
            if (soal.tipe_soal === 'pilihan_ganda') {
                const { data: pilihan } = await supabase
                    .from('pilihan_jawaban')
                    .select('*')
                    .eq('soal_id', soal.soal_id)
                    .order('urutan', { ascending: true });

                return { ...soal, pilihan: pilihan || [] };
            } else {
                const { data: kunci } = await supabase
                    .from('kunci_jawaban')
                    .select('*')
                    .eq('soal_id', soal.soal_id)
                    .single();

                return { ...soal, kunci_jawaban: kunci };
            }
        }));

        // Build the Word Document
        const children: any[] = [];

        // Header
        children.push(
            new Paragraph({
                text: kuis.judul,
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: `Dibuat oleh: `, bold: true }),
                    new TextRun({ text: authorName })
                ],
                spacing: { after: 400 }
            })
        );

        // Questions
        populatedSoal.forEach((soal, index) => {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${index + 1}. `, bold: true }),
                        new TextRun({ text: soal.teks_soal })
                    ],
                    spacing: { before: 200, after: 100 }
                })
            );

            if (soal.tipe_soal === 'pilihan_ganda' && soal.pilihan) {
                soal.pilihan.forEach((p: any, pIndex: number) => {
                    const label = String.fromCharCode(65 + pIndex);
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${label}. `, bold: p.is_benar }),
                                new TextRun({ text: p.teks_pilihan, bold: p.is_benar })
                            ],
                            indent: { left: 720 },
                            spacing: { after: 50 }
                        })
                    );
                });
            }

            if (soal.kunci_jawaban && soal.kunci_jawaban.jawaban_text) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Jawaban / Penjelasan: ', italics: true, color: '555555' }),
                            new TextRun({ text: soal.kunci_jawaban.jawaban_text, italics: true, color: '555555' })
                        ],
                        indent: { left: 720 },
                        spacing: { before: 100, after: 200 }
                    })
                );
            }
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }]
        });

        const buffer = await Packer.toBuffer(doc);

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${kuis.judul}.docx"`,
            },
        });

    } catch (error: any) {
        console.error('Download word error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
