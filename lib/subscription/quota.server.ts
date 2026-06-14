import { supabaseServer } from '@/lib/supabase/server';

export async function countGeneratesLast24Hours(userId: number): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseServer
    .from('kuis')
    .select('kuis_id', { count: 'exact', head: true })
    .eq('guru_id', userId)
    .gte('created_at', since);

  if (error) {
    console.error('countGeneratesLast24Hours:', error);
    throw new Error('Gagal memeriksa kuota generate');
  }
  return count ?? 0;
}
