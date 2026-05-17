// Fusion des supports pédagogiques épinglés à la fin d'une séance.
// Additif : ne modifie jamais le corps existant de la séance, on ajoute
// uniquement (ou complète) une section dédiée à la fin.

export interface LessonSupportItem {
  heading: string;
  content: string;
}

export const SUPPORTS_SECTION_TITLE = '## 📎 Supports pédagogiques';

/**
 * Ajoute les supports fournis à la fin du markdown de la séance, sous une
 * section unique "## 📎 Supports pédagogiques". Idempotent au niveau d'un
 * support : un support dont le titre ET le contenu sont déjà présents n'est
 * pas ré-ajouté.
 */
export function mergeSupportsIntoLesson(
  lessonMarkdown: string,
  items: LessonSupportItem[]
): string {
  if (!items || items.length === 0) return lessonMarkdown;

  let md = (lessonMarkdown || '').trimEnd();

  if (!md.includes(SUPPORTS_SECTION_TITLE)) {
    md += `\n\n---\n\n${SUPPORTS_SECTION_TITLE}\n`;
  }

  for (const item of items) {
    const heading = item.heading.trim();
    const content = item.content.trim();
    if (!content) continue;

    const headingMarker = `### ${heading}`;
    // Évite un doublon évident (même titre + même contenu déjà présents)
    if (md.includes(headingMarker) && md.includes(content)) continue;

    md += `\n\n${headingMarker}\n\n${content}\n`;
  }

  return md + '\n';
}
