import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const { soalId } = params;

    await supabase.from('pilihan_jawaban').delete().eq('soal_id', soalId);
    await supabase.from('kunci_jawaban').delete().eq('soal_id', soalId);
    
    const { error } = await supabase.from('soal').delete().eq('soal_id', soalId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete question error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
