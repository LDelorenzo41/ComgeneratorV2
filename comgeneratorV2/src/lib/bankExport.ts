// src/lib/bankExport.ts
// Export du patrimoine pédagogique de l'utilisateur dans un fichier
// « .profassist » : une archive JSON versionnée, lisible telle quelle et
// destinée à être réimportable.
//
// L'opération est strictement en lecture — aucune écriture, aucune
// suppression, aucun appel IA. Elle peut être lancée à tout moment sans
// aucun effet sur les données.

import { supabase } from './supabase';

export const BANK_EXPORT_FORMAT = 'profassist-bank-export';

/**
 * Version du schéma d'archive. À incrémenter dès qu'une structure change,
 * afin qu'un futur import sache reconnaître — et convertir — les fichiers
 * produits par les versions antérieures.
 */
export const BANK_EXPORT_SCHEMA_VERSION = 1;

/** Ligne brute telle que renvoyée par PostgREST. */
type Row = Record<string, unknown>;

/** Sections exportées, dans l'ordre du récapitulatif présenté à l'utilisateur. */
export const BANK_SECTIONS = [
  { key: 'appreciations', label: 'appréciations' },
  { key: 'lessons_bank', label: 'séances' },
  { key: 'scenarios_bank', label: 'scénarios' },
  { key: 'chatbot_answers', label: 'réponses du chatbot' },
  { key: 'subjects', label: 'matières' },
  { key: 'criteria', label: "critères d'évaluation" },
  { key: 'signatures', label: 'signatures' },
] as const;

export interface BankExport {
  format: typeof BANK_EXPORT_FORMAT;
  schemaVersion: number;
  /** Date de production, au format ISO 8601. */
  exportedAt: string;
  application: { name: string; url: string };
  account: { userId: string; email: string | null };
  /** Nombre de contenus par section, pour vérification d'un coup d'œil. */
  counts: Record<string, number>;
  /** Anomalies non bloquantes rencontrées pendant l'export. */
  warnings: string[];
  data: Record<string, Row[]>;
}

/** PostgREST paginne au-delà de cette taille ; on boucle jusqu'à épuisement. */
const PAGE_SIZE = 1000;

type QueryFilter = (query: any) => any;

/**
 * Récupère toutes les lignes d'une table, page par page.
 *
 * Retourne 'missing' si la table n'existe pas (code PostgreSQL 42P01) : ce
 * cas devient une section vide assortie d'un avertissement. Toute autre
 * erreur interrompt l'export — une sauvegarde silencieusement incomplète
 * serait plus dangereuse qu'une absence de sauvegarde, puisque l'utilisateur
 * la croirait fiable.
 */
async function fetchAllRows(table: string, applyFilter: QueryFilter): Promise<Row[] | 'missing'> {
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    // Le client typé ne connaît pas toutes les tables de production
    // (scenarios_bank est absente de database.types.ts) : on interroge donc
    // par nom, sans passer par les génériques.
    const query = applyFilter(
      (supabase as any)
        .from(table)
        .select('*')
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
    );

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') return 'missing';
      throw new Error(`Lecture de « ${table} » impossible : ${error.message}`);
    }

    const page = (data ?? []) as Row[];
    rows.push(...page);

    // Une page incomplète signifie qu'on a atteint la fin.
    if (page.length < PAGE_SIZE) return rows;
  }
}

/**
 * Constitue l'archive complète du patrimoine de l'utilisateur connecté.
 * Lève une erreur explicite si la session est absente ou si une table
 * existante devient illisible.
 */
export async function buildBankExport(): Promise<BankExport> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Vous devez être connecté pour exporter votre Banque.');
  }

  const warnings: string[] = [];
  const data: Record<string, Row[]> = {};

  const collect = async (table: string, applyFilter: QueryFilter): Promise<Row[]> => {
    const result = await fetchAllRows(table, applyFilter);

    if (result === 'missing') {
      warnings.push(`Section « ${table} » indisponible sur ce serveur : exportée vide.`);
      data[table] = [];
      return [];
    }

    data[table] = result;
    return result;
  };

  const ownedByUser: QueryFilter = (query) => query.eq('user_id', user.id);

  await collect('appreciations', ownedByUser);
  await collect('lessons_bank', ownedByUser);
  await collect('scenarios_bank', ownedByUser);
  await collect('chatbot_answers', ownedByUser);
  await collect('signatures', ownedByUser);

  // Les critères ne portent pas de user_id : ils sont rattachés aux matières,
  // qui elles appartiennent à l'utilisateur.
  const subjects = await collect('subjects', ownedByUser);
  const subjectIds = subjects
    .map((subject) => subject.id)
    .filter((id): id is string => typeof id === 'string');

  if (subjectIds.length > 0) {
    await collect('criteria', (query) => query.in('subject_id', subjectIds));
  } else {
    data.criteria = [];
  }

  const counts: Record<string, number> = {};
  for (const section of BANK_SECTIONS) {
    counts[section.key] = data[section.key]?.length ?? 0;
  }

  return {
    format: BANK_EXPORT_FORMAT,
    schemaVersion: BANK_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    application: { name: 'ProfAssist', url: 'https://profassist.net' },
    account: { userId: user.id, email: user.email ?? null },
    counts,
    warnings,
    data,
  };
}

/** Nombre total de contenus contenus dans une archive. */
export function totalBankItems(payload: BankExport): number {
  return Object.values(payload.counts).reduce((total, count) => total + count, 0);
}

/** Récapitulatif lisible : « 12 appréciations, 3 séances ». */
export function describeBankExport(payload: BankExport): string {
  return BANK_SECTIONS
    .filter((section) => (payload.counts[section.key] ?? 0) > 0)
    .map((section) => `${payload.counts[section.key]} ${section.label}`)
    .join(', ');
}

export function bankExportFilename(payload: BankExport): string {
  return `profassist-banque-${payload.exportedAt.slice(0, 10)}.profassist`;
}

/** Déclenche le téléchargement de l'archive et retourne le nom du fichier. */
export function downloadBankExport(payload: BankExport): string {
  const filename = bankExportFilename(payload);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Révocation différée : libérer l'URL dans le même cycle que le clic
  // interrompt le téléchargement sur certains navigateurs.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
