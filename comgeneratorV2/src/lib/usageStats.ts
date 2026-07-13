import { supabase } from './supabase';

// Journal des générations : alimente les compteurs de la page Mon espace.
// Toutes les fonctions sont best-effort : un échec (table absente, réseau…)
// ne doit jamais perturber la génération elle-même.

export type GenerationKind =
  | 'appreciation'
  | 'synthese'
  | 'lesson'
  | 'exercise'
  | 'scenario'
  | 'communication';

export async function logGeneration(kind: GenerationKind): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('generation_events').insert({ user_id: user.id, kind });
  } catch {
    // Journalisation silencieuse uniquement
  }
}

export type GenerationCounts = Record<GenerationKind, number>;

// Compteurs depuis une date donnée. Retourne null si le journal est
// indisponible (migration non appliquée) pour permettre un repli.
export async function fetchGenerationCounts(userId: string, sinceIso: string): Promise<GenerationCounts | null> {
  try {
    const { data, error } = await supabase
      .from('generation_events')
      .select('kind')
      .eq('user_id', userId)
      .gte('created_at', sinceIso);

    if (error) return null;

    const counts: GenerationCounts = {
      appreciation: 0,
      synthese: 0,
      lesson: 0,
      exercise: 0,
      scenario: 0,
      communication: 0
    };
    (data || []).forEach((row: { kind: string }) => {
      if (row.kind in counts) counts[row.kind as GenerationKind]++;
    });
    return counts;
  } catch {
    return null;
  }
}
