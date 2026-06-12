export function parseKunciJawaban(raw: string | null | undefined): { kunci: string; penjelasan: string | null } {
  if (!raw || !String(raw).trim()) return { kunci: '', penjelasan: null };
  const t = String(raw).trim();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>;
      const kunci = String(j.kunci ?? j.jawaban_benar ?? '').trim();
      const penjelasanRaw = j.penjelasan ?? j.explanation;
      const penjelasan =
        typeof penjelasanRaw === 'string' && penjelasanRaw.trim().length > 0 ? penjelasanRaw.trim() : null;
      return { kunci: kunci || t, penjelasan };
    } catch {
      /* fallthrough */
    }
  }
  return { kunci: t, penjelasan: null };
}

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
export function isEssayUraian(tipeSoal: string, jawabanTextRaw: string | null | undefined): boolean {
  if (tipeSoal !== 'uraian') return false;
  const raw = (jawabanTextRaw || '').trim();
  if (!raw) return false;
  if (raw.startsWith('{')) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      if (typeof j.penjelasan === 'string' && j.penjelasan.trim().length > 0) return true;
    } catch {
      return raw.length > 300;
    }
  }
  return raw.length > 300 || raw.includes('\n\n');
}
