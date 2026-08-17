// src/lib/bankArchiveHtml.ts
// Rend l'archive de la Banque sous forme d'une page HTML autonome.
//
// Pourquoi du HTML plutôt qu'un fichier de données : l'archive doit rester
// utile à un enseignant qui n'a plus ProfAssist sous la main. Un fichier
// .json ou .profassist n'est associé à aucune application — double-cliquer
// dessus ne donne rien d'exploitable. Une page HTML s'ouvre dans n'importe
// quel navigateur, se lit, se cherche (Ctrl+F), s'imprime et se convertit en
// PDF, sans connexion et sans logiciel particulier.
//
// Le fichier reste néanmoins réimportable : les données brutes sont
// embarquées dans un bloc <script type="application/json"> que le futur
// import lira directement. Une seule archive sert donc les deux usages —
// lecture humaine et restauration automatique.

import type { BankExport } from './bankExport';

type Row = Record<string, unknown>;

/** Échappe le texte destiné au corps du document. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Neutralise « < » dans le JSON embarqué : un contenu pédagogique contenant
 * « </script> » couperait sinon le bloc de données. La séquence < reste
 * du JSON valide et se reparse en « < ».
 */
function escapeJsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c');
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Libellés lisibles des tags d'appréciation stockés en base. */
const APPRECIATION_TAGS: Record<string, string> = {
  tres_bien: 'Très bien',
  bien: 'Bien',
  moyen: 'Moyen',
  insuffisant: 'Insuffisant',
};

interface Block {
  label?: string;
  body: string;
}

interface SectionRenderer {
  key: string;
  title: string;
  heading: (row: Row) => string;
  meta: (row: Row) => string[];
  blocks: (row: Row) => Block[];
}

const SECTION_RENDERERS: SectionRenderer[] = [
  {
    key: 'appreciations',
    title: 'Appréciations',
    heading: (row) => APPRECIATION_TAGS[text(row, 'tag')] || 'Appréciation',
    meta: (row) => [formatDate(row.created_at)],
    blocks: (row) => [
      { label: 'Version détaillée', body: text(row, 'detailed') },
      { label: 'Version synthétique', body: text(row, 'summary') },
    ],
  },
  {
    key: 'lessons_bank',
    title: 'Séances',
    heading: (row) => text(row, 'topic') || 'Séance',
    meta: (row) => [
      text(row, 'subject'),
      text(row, 'level'),
      text(row, 'pedagogy_type'),
      text(row, 'duration') ? `${text(row, 'duration')} min` : '',
      formatDate(row.created_at),
    ],
    blocks: (row) => [{ body: text(row, 'content') }],
  },
  {
    key: 'scenarios_bank',
    title: 'Scénarios pédagogiques',
    heading: (row) => text(row, 'theme') || 'Scénario',
    meta: (row) => [
      text(row, 'matiere'),
      text(row, 'niveau'),
      text(row, 'nombre_seances') ? `${text(row, 'nombre_seances')} séances` : '',
      text(row, 'duree_seance') ? `${text(row, 'duree_seance')} min` : '',
      formatDate(row.created_at),
    ],
    blocks: (row) => [{ body: text(row, 'content') }],
  },
  {
    key: 'chatbot_answers',
    title: 'Réponses conservées',
    heading: (row) => text(row, 'title') || 'Réponse',
    meta: (row) => [
      text(row, 'category'),
      text(row, 'subject'),
      text(row, 'level'),
      formatDate(row.created_at),
    ],
    blocks: (row) => [{ body: text(row, 'content') }],
  },
  {
    key: 'signatures',
    title: 'Signatures',
    heading: (row) => text(row, 'name') || 'Signature',
    meta: (row) => [row.is_default === true ? 'Signature par défaut' : ''],
    blocks: (row) => [{ body: text(row, 'content') }],
  },
];

/** Matières et critères : une liste imbriquée plutôt que des blocs de texte. */
function renderSubjects(payload: BankExport): string {
  const subjects = payload.data.subjects ?? [];
  const criteria = payload.data.criteria ?? [];
  if (subjects.length === 0) return '';

  const items = subjects
    .map((subject) => {
      const own = criteria.filter((criterion) => criterion.subject_id === subject.id);
      const list = own.length
        ? `<ul class="criteres">${own
            .map((criterion) => {
              const importance = text(criterion, 'importance');
              const poids = importance ? ` <span class="poids">importance ${escapeHtml(importance)}/3</span>` : '';
              return `<li>${escapeHtml(text(criterion, 'name'))}${poids}</li>`;
            })
            .join('')}</ul>`
        : '<p class="vide">Aucun critère enregistré.</p>';

      return `<article class="fiche">
        <h3>${escapeHtml(text(subject, 'name') || 'Matière')}</h3>
        ${list}
      </article>`;
    })
    .join('');

  return `<section id="subjects">
    <h2>Matières et critères d'évaluation <span class="compte">${subjects.length}</span></h2>
    ${items}
  </section>`;
}

function renderSection(renderer: SectionRenderer, rows: Row[]): string {
  if (rows.length === 0) return '';

  const articles = rows
    .map((row) => {
      const meta = renderer
        .meta(row)
        .filter((value) => value && value.trim())
        .map((value) => `<span>${escapeHtml(value)}</span>`)
        .join('');

      const blocks = renderer
        .blocks(row)
        .filter((block) => block.body && block.body.trim())
        .map((block) => {
          const label = block.label ? `<h4>${escapeHtml(block.label)}</h4>` : '';
          return `${label}<pre>${escapeHtml(block.body)}</pre>`;
        })
        .join('');

      return `<article class="fiche">
        <h3>${escapeHtml(renderer.heading(row))}</h3>
        ${meta ? `<p class="meta">${meta}</p>` : ''}
        ${blocks}
      </article>`;
    })
    .join('');

  return `<section id="${renderer.key}">
    <h2>${escapeHtml(renderer.title)} <span class="compte">${rows.length}</span></h2>
    ${articles}
  </section>`;
}

/**
 * Produit le document HTML complet et autonome : aucune ressource externe,
 * aucun script d'affichage — la page reste lisible même si JavaScript est
 * désactivé, et le bloc de données sert uniquement à la réimportation.
 */
export function renderBankArchiveHtml(payload: BankExport): string {
  const sections = SECTION_RENDERERS
    .map((renderer) => renderSection(renderer, payload.data[renderer.key] ?? []))
    .join('');

  const sommaire = [
    ...SECTION_RENDERERS.map((renderer) => ({
      key: renderer.key,
      title: renderer.title,
      count: payload.counts[renderer.key] ?? 0,
    })),
    { key: 'subjects', title: 'Matières et critères', count: payload.counts.subjects ?? 0 },
  ]
    .filter((entry) => entry.count > 0)
    .map((entry) => `<li><a href="#${entry.key}">${escapeHtml(entry.title)}</a> <span>${entry.count}</span></li>`)
    .join('');

  const avertissements = payload.warnings.length
    ? `<div class="avertissement"><strong>Remarques :</strong><ul>${payload.warnings
        .map((warning) => `<li>${escapeHtml(warning)}</li>`)
        .join('')}</ul></div>`
    : '';

  const donnees = escapeJsonForScript(JSON.stringify(payload));

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ma Banque ProfAssist — ${escapeHtml(payload.exportedAt.slice(0, 10))}</title>
<style>
  :root {
    --encre: #1c2320; --doux: #5d6b62; --trait: #d8e0d9;
    --fond: #ffffff; --carte: #f7faf8; --accent: #1d6a4f;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --encre: #e6ece7; --doux: #9aa79f; --trait: #2d3630;
      --fond: #141815; --carte: #1b211d; --accent: #57bd92;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 24px 80px; background: var(--fond); color: var(--encre);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  .page { max-width: 900px; margin: 0 auto; }
  header { border-bottom: 3px solid var(--accent); padding-bottom: 20px; margin-bottom: 28px; }
  h1 { font-size: 30px; margin: 0 0 6px; }
  .sous-titre { color: var(--doux); margin: 0; }
  nav ul { list-style: none; padding: 0; margin: 24px 0 0;
           display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px 20px; }
  nav li { display: flex; justify-content: space-between; border-bottom: 1px dotted var(--trait); padding: 4px 0; }
  nav a { color: var(--encre); text-decoration: none; }
  nav a:hover { color: var(--accent); }
  nav li span { color: var(--doux); font-variant-numeric: tabular-nums; }
  section { margin-top: 44px; }
  h2 { font-size: 22px; border-bottom: 1px solid var(--trait); padding-bottom: 8px; }
  .compte { color: var(--doux); font-size: 15px; font-weight: normal; }
  .fiche { background: var(--carte); border: 1px solid var(--trait); border-radius: 10px;
           padding: 18px 22px; margin-bottom: 16px; }
  .fiche h3 { margin: 0 0 6px; font-size: 18px; }
  .fiche h4 { margin: 16px 0 4px; font-size: 13px; text-transform: uppercase;
              letter-spacing: .06em; color: var(--doux); }
  .meta { margin: 0 0 12px; color: var(--doux); font-size: 14px; }
  .meta span:not(:last-child)::after { content: " · "; }
  pre {
    white-space: pre-wrap; word-wrap: break-word; margin: 0;
    font-family: inherit; font-size: 15px; line-height: 1.65;
  }
  .criteres { margin: 8px 0 0; padding-left: 20px; }
  .poids { color: var(--doux); font-size: 13px; }
  .vide { color: var(--doux); font-style: italic; margin: 6px 0 0; }
  .avertissement { background: var(--carte); border-left: 4px solid var(--accent);
                   padding: 12px 18px; margin-top: 24px; border-radius: 0 8px 8px 0; }
  footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid var(--trait);
           color: var(--doux); font-size: 13px; }
  @media print {
    :root { --encre: #000; --doux: #444; --trait: #ccc; --fond: #fff; --carte: #fff; }
    body { padding: 0; }
    nav { display: none; }
    .fiche { break-inside: avoid; page-break-inside: avoid; border: none;
             border-bottom: 1px solid #ccc; border-radius: 0; padding-left: 0; padding-right: 0; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <h1>Ma Banque ProfAssist</h1>
    <p class="sous-titre">
      Sauvegarde du ${escapeHtml(formatDate(payload.exportedAt) || payload.exportedAt.slice(0, 10))}${
        payload.account.email ? ` — compte ${escapeHtml(payload.account.email)}` : ''
      }
    </p>
    <nav><ul>${sommaire}</ul></nav>
  </header>

  ${avertissements}
  ${sections}
  ${renderSubjects(payload)}

  <footer>
    <p>
      Document autonome : il s'ouvre dans n'importe quel navigateur, sans connexion
      et sans logiciel particulier. Utilisez Ctrl+F pour chercher, et la fonction
      « Imprimer » de votre navigateur pour l'enregistrer en PDF.
    </p>
    <p>
      Ce fichier contient également vos données sous forme réutilisable, afin de
      pouvoir être réimporté dans ProfAssist. Conservez-le tel quel si vous
      souhaitez garder cette possibilité.
    </p>
  </footer>
</div>

<script id="profassist-data" type="application/json">${donnees}</script>
</body>
</html>`;
}
