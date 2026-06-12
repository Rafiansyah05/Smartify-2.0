import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const { id } = params;

    const { error } = await supabase
      .from('kuis')
      .update({ status: 'published' })
      .eq('kuis_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Publish quiz error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
