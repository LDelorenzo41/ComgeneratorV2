// src/help/parseTutorial.ts
// Découpe un tutoriel Markdown en rubriques : chaque titre « ## » ouvre une
// rubrique, qui devient une entrée du menu en haut du panneau d'aide.

export interface TutorialSection {
  id: string;
  title: string;
  content: string;
}

export interface Tutorial {
  /** Texte placé avant la première rubrique : présentation courte de la page. */
  intro: string;
  sections: TutorialSection[];
}

// « ## Titre » ou « ## Titre {#identifiant} ». L'identifiant explicite permet
// d'ouvrir l'aide directement sur une rubrique (voir initialSection, topics.ts).
const SECTION_HEADING = /^##\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/;

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseTutorial(markdown: string): Tutorial {
  const introLines: string[] = [];
  const sections: TutorialSection[] = [];
  const usedIds = new Set<string>();
  let current: { id: string; title: string; lines: string[] } | null = null;

  const flush = () => {
    if (current) {
      sections.push({ id: current.id, title: current.title, content: current.lines.join('\n').trim() });
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = SECTION_HEADING.exec(line);
    if (!heading) {
      (current ? current.lines : introLines).push(line);
      continue;
    }

    flush();
    const title = heading[1].trim();
    const baseId = heading[2] || slugify(title) || 'rubrique';
    let id = baseId;
    for (let n = 2; usedIds.has(id); n++) id = `${baseId}-${n}`;
    usedIds.add(id);
    current = { id, title, lines: [] };
  }
  flush();

  return { intro: introLines.join('\n').trim(), sections };
}
