import { supabase } from './supabase';
import type { FeedbackSession, FeedbackRating, FeedbackComment, FeedbackSynthesisData, SectionSynthesis } from '../types/feedback';
import { FEEDBACK_SECTIONS } from '../types/feedback';

// Soumettre un feedback complet (session + ratings + comments)
export async function submitFeedback(
  session: Omit<FeedbackSession, 'id' | 'created_at'>,
  ratings: Omit<FeedbackRating, 'id' | 'session_id' | 'created_at'>[],
  comments: Omit<FeedbackComment, 'id' | 'session_id' | 'created_at'>[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Créer la session
    // L'id est généré côté client : un INSERT ... RETURNING (.select() après
    // .insert()) exigerait une policy RLS SELECT pour anon, qui exposerait
    // les emails des testeurs. Sans RETURNING, la policy INSERT seule suffit.
    const sessionId = crypto.randomUUID();
    const { error: sessionError } = await supabase
      .from('feedback_sessions')
      .insert({ ...session, id: sessionId, completed: true });

    if (sessionError) {
      // Doublon email → l'utilisateur a déjà répondu
      if (sessionError.code === '23505') {
        return { success: false, error: 'Vous avez déjà soumis un feedback avec cette adresse email.' };
      }
      throw new Error(sessionError.message || 'Erreur lors de la création de la session');
    }

    // 2. Insérer les ratings (batch)
    if (ratings.length > 0) {
      const ratingsWithSession = ratings.map(r => ({
        ...r,
        session_id: sessionId,
      }));

      const { error: ratingsError } = await supabase
        .from('feedback_ratings')
        .insert(ratingsWithSession);

      if (ratingsError) {
        throw new Error(ratingsError.message);
      }
    }

    // 3. Insérer les commentaires non vides (batch)
    const nonEmptyComments = comments.filter(c => c.comment.trim().length > 0);
    if (nonEmptyComments.length > 0) {
      const commentsWithSession = nonEmptyComments.map(c => ({
        ...c,
        session_id: sessionId,
      }));

      const { error: commentsError } = await supabase
        .from('feedback_comments')
        .insert(commentsWithSession);

      if (commentsError) {
        throw new Error(commentsError.message);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Erreur soumission feedback:', error);
    return { success: false, error: error.message };
  }
}

// Récupérer la synthèse complète (admin uniquement)
export async function fetchFeedbackSynthesis(): Promise<FeedbackSynthesisData> {
  // Récupérer les sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('feedback_sessions')
    .select('*')
    .eq('completed', true)
    .order('created_at', { ascending: false });

  if (sessionsError) throw sessionsError;

  // Récupérer tous les ratings
  const { data: allRatings, error: ratingsError } = await supabase
    .from('feedback_ratings')
    .select('*');

  if (ratingsError) throw ratingsError;

  // Récupérer tous les commentaires
  const { data: allComments, error: commentsError } = await supabase
    .from('feedback_comments')
    .select('session_id, section, comment, created_at');

  if (commentsError) throw commentsError;

  // Construire un map session_id -> tester_name
  const sessionNameMap: Record<string, string> = {};
  (sessions || []).forEach(s => {
    sessionNameMap[s.id] = s.tester_name || 'Anonyme';
  });

  // Sections : features + ux_design + pricing + general
  const allSectionKeys = [
    ...FEEDBACK_SECTIONS.map(s => s.key),
    'ux_design',
    'pricing',
    'general',
    'general_preferee',
  ];

  const allSectionLabels: Record<string, string> = {
    ...Object.fromEntries(FEEDBACK_SECTIONS.map(s => [s.key, s.label])),
    ux_design: 'UX / Design / Navigation',
    pricing: 'Tarification',
    general: 'Satisfaction Générale',
    general_preferee: 'Fonctionnalité préférée',
  };

  const sections: SectionSynthesis[] = allSectionKeys.map(sectionKey => {
    // Filtrer ratings par section
    const sectionRatings = (allRatings || []).filter(r => r.section === sectionKey);

    // Grouper par question_key et calculer la moyenne
    const ratingsByKey: Record<string, { total: number; count: number }> = {};
    sectionRatings.forEach(r => {
      if (!ratingsByKey[r.question_key]) {
        ratingsByKey[r.question_key] = { total: 0, count: 0 };
      }
      ratingsByKey[r.question_key].total += r.rating;
      ratingsByKey[r.question_key].count += 1;
    });

    const ratings: Record<string, { average: number; count: number }> = {};
    Object.entries(ratingsByKey).forEach(([key, val]) => {
      ratings[key] = {
        average: Math.round((val.total / val.count) * 10) / 10,
        count: val.count,
      };
    });

    // Filtrer commentaires par section
    const sectionComments = (allComments || [])
      .filter(c => c.section === sectionKey)
      .map(c => ({
        comment: c.comment,
        tester_name: sessionNameMap[c.session_id] || 'Anonyme',
        created_at: c.created_at,
      }));

    return {
      section: sectionKey,
      label: allSectionLabels[sectionKey] || sectionKey,
      ratings,
      comments: sectionComments,
    };
  });

  return {
    totalResponses: (sessions || []).length,
    sessions: sessions || [],
    sections,
  };
}

// Export CSV
export function exportFeedbackCSV(data: FeedbackSynthesisData): string {
  const lines: string[] = [];

  // En-tête sessions
  lines.push('=== SESSIONS ===');
  lines.push('Nom,Email,Matière,Niveau,Ancienneté,A acheté tokens,Prévoit acheter,Raison,Date');
  data.sessions.forEach(s => {
    lines.push([
      s.tester_name || 'Anonyme',
      s.tester_email || '',
      s.matiere || '',
      s.niveau || '',
      s.anciennete?.toString() || '',
      s.a_achete_tokens ? 'Oui' : 'Non',
      s.prevoit_acheter || '',
      `"${(s.raison_achat || '').replace(/"/g, '""')}"`,
      s.created_at || '',
    ].join(','));
  });

  lines.push('');
  lines.push('=== MOYENNES PAR SECTION ===');
  lines.push('Section,Question,Moyenne,Réponses');
  data.sections.forEach(section => {
    Object.entries(section.ratings).forEach(([questionKey, val]) => {
      lines.push([section.label, questionKey, val.average.toString(), val.count.toString()].join(','));
    });
  });

  lines.push('');
  lines.push('=== COMMENTAIRES ===');
  lines.push('Section,Testeur,Commentaire,Date');
  data.sections.forEach(section => {
    section.comments.forEach(c => {
      lines.push([
        section.label,
        c.tester_name,
        `"${c.comment.replace(/"/g, '""')}"`,
        c.created_at,
      ].join(','));
    });
  });

  return lines.join('\n');
}