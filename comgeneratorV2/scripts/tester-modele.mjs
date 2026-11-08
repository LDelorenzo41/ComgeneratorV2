#!/usr/bin/env node
// scripts/tester-modele.mjs
//
// Vérifie qu'un modèle OpenAI accepte les appels tels que ProfAssist les envoie
// aujourd'hui, et le compare aux modèles actuels. Outil de migration : OpenAI
// retire régulièrement ses modèles (échéances : docs/CONTEXTE-STRATEGIE.md, § 6).
//
//   node scripts/tester-modele.mjs              teste gpt-6-luna
//   node scripts/tester-modele.mjs <modèle>     teste un autre modèle
//
// - La clé est lue dans la variable OPENAI_API_KEY, sinon demandée au clavier
//   (saisie masquée). Elle n'est ni affichée ni écrite dans le fichier.
// - Prompts fictifs, sans aucune donnée d'élève.
// - Résultats complets écrits dans le dossier personnel, hors du dépôt, pour
//   qu'ils ne puissent pas être commités par erreur.
// - OPENAI_BASE_URL permet de viser une autre API compatible OpenAI.
// Aucune dépendance : Node 18 ou plus récent.

import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';

const MODELE = process.argv[2] || 'gpt-6-luna';
const REF_APPRECIATION = 'gpt-4o-mini'; // modèle actuel des appréciations et synthèses
const REF_LONG = 'gpt-4.1-mini';        // modèle actuel des séances, scénarios, communication
const API = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const DELAI_MAX_S = 180;                // une Edge Function est coupée vers 150 s
const FICHIER = join(homedir(), `resultats-test-${MODELE.replace(/[^a-zA-Z0-9.\-]/g, '_')}.txt`);

// Prompts fictifs, calqués sur les appels réels de ProfAssist
const APPRECIATION = [
  { role: 'system', content: "Tu es un professeur qui rédige des appréciations de bulletin scolaire, bienveillantes, précises et sans formule creuse." },
  { role: 'user', content: "Rédige une appréciation de 400 caractères maximum pour un élève sérieux et volontaire en EPS, en progrès en endurance, qui doit encore gagner en confiance dans les activités collectives. Réponds uniquement par le texte de l'appréciation." },
];
const ANALYSE_JSON = [
  { role: 'user', content: "Analyse ce brouillon et réponds en JSON avec les clés objet, ton et destinataire : « Bonjour, je souhaite informer les familles de la sortie scolaire au musée du 12 décembre ; merci de rendre l'autorisation signée avant le 5. »" },
];
const SCENARIO = [
  { role: 'system', content: 'Tu es un expert en ingénierie pédagogique en EPS au collège.' },
  { role: 'user', content: 'Rédige une séquence de 8 séances de volley-ball pour une classe de 4e : un tableau markdown à 5 colonnes (séance, objectif, obstacles et différenciation, activités, évaluation), puis des notes pédagogiques détaillées.' },
];

let CLE = '';
const rapport = [];

const masquer = (texte) => {
  let s = String(texte ?? '');
  if (CLE) s = s.split(CLE).join('[clé masquée]');
  return s.replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…');
};
const ecrire = (ligne = '') => rapport.push(masquer(ligne));
const message = (r) => String(r.donnees?.error?.message ?? r.brut ?? '');

function demanderCleMasquee(question) {
  return new Promise((resolve) => {
    // La consigne va sur sa propre ligne : readline efface la ligne de saisie
    // en démarrant, ce qui la ferait disparaître si elle était sur la même ligne.
    process.stdout.write(`${question}\n`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = () => {}; // rien de ce qui est tapé ou collé n'est affiché
    rl.question('', (reponse) => {
      rl.close();
      process.stdout.write('\n');
      resolve(reponse.trim());
    });
  });
}

async function appel(chemin, corps) {
  const debut = Date.now();
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), DELAI_MAX_S * 1000);
  try {
    const rep = await fetch(`${API}${chemin}`, {
      method: corps ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${CLE}`, ...(corps && { 'Content-Type': 'application/json' }) },
      ...(corps && { body: JSON.stringify(corps) }),
      signal: ctrl.signal,
    });
    const brut = await rep.text();
    let donnees = null;
    try { donnees = JSON.parse(brut); } catch { /* réponse non JSON */ }
    return { statut: rep.status, donnees, brut, duree: (Date.now() - debut) / 1000 };
  } catch (e) {
    const brut = e.name === 'AbortError' ? `aucune réponse après ${DELAI_MAX_S} s` : `connexion impossible (${e.message})`;
    return { statut: 0, donnees: null, brut, duree: (Date.now() - debut) / 1000 };
  } finally {
    clearTimeout(minuterie);
  }
}

const refusParametre = (r) =>
  ['max_tokens', 'temperature'].includes(r.donnees?.error?.param) ||
  /max_tokens|temperature|unsupported (parameter|value)/i.test(message(r));
const refusEndpoint = (r) => /v1\/responses|not supported|chat model|chat\/completions/i.test(message(r));

// Essaie d'abord l'appel tel que ProfAssist le fait aujourd'hui, puis des
// variantes si le modèle le refuse : sans temperature avec max_completion_tokens,
// puis l'API Responses. Chaque essai est consigné.
async function generer(modele, messages, { temperature, maxTokens, json = false, adapter = true }) {
  const format = json ? { response_format: { type: 'json_object' } } : {};
  const essais = [];
  let r = await appel('/chat/completions', { model: modele, messages, temperature, max_tokens: maxTokens, ...format });
  essais.push({ variante: 'Chat Completions avec max_tokens et temperature (appel actuel de ProfAssist)', r });
  if (adapter && r.statut === 400 && refusParametre(r)) {
    r = await appel('/chat/completions', { model: modele, messages, max_completion_tokens: maxTokens, ...format });
    essais.push({ variante: 'Chat Completions avec max_completion_tokens, sans temperature', r });
  }
  if (adapter && (r.statut === 400 || r.statut === 404) && refusEndpoint(r)) {
    const input = messages.map((m) => m.content).join('\n\n---\n\n');
    r = await appel('/responses', {
      model: modele, input, max_output_tokens: maxTokens,
      text: { format: { type: json ? 'json_object' : 'text' } },
    });
    essais.push({ variante: 'API Responses', r });
  }
  return essais;
}

function analyser(r) {
  const d = r.donnees ?? {};
  if (Array.isArray(d.choices)) {
    return {
      contenu: d.choices[0]?.message?.content ?? null,
      fin: d.choices[0]?.finish_reason ?? null,
      entree: d.usage?.prompt_tokens, sortie: d.usage?.completion_tokens, total: d.usage?.total_tokens,
      raisonnement: d.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    };
  }
  if (d.object === 'response') {
    let contenu = typeof d.output_text === 'string' ? d.output_text : null;
    if (contenu === null) {
      contenu = (d.output ?? []).flatMap((o) => o.content ?? [])
        .filter((c) => c.type === 'output_text').map((c) => c.text).join('') || null;
    }
    return {
      contenu,
      fin: d.status === 'completed' ? 'stop' : (d.incomplete_details?.reason ?? d.status),
      entree: d.usage?.input_tokens, sortie: d.usage?.output_tokens, total: d.usage?.total_tokens,
      raisonnement: d.usage?.output_tokens_details?.reasoning_tokens ?? 0,
    };
  }
  return { contenu: null, fin: null };
}

function verdict(r, a, { json = false } = {}) {
  if (r.statut === 0) return `❌ Pas de réponse : ${r.brut}`;
  if (r.statut === 401) return '❌ Clé refusée (401) : vérifie que la clé a été collée en entier.';
  if (r.statut === 429) return '❌ Limite atteinte ou crédit insuffisant sur le compte OpenAI (429).';
  if (r.statut === 404) return '❌ Modèle introuvable pour ce compte (404).';
  if (r.statut !== 200) return `❌ Refus ${r.statut} : ${message(r).slice(0, 220)}`;
  if (typeof a.contenu !== 'string') {
    return `⚠️ Le texte n'arrive pas sous forme de chaîne (${Array.isArray(a.contenu) ? 'liste de morceaux' : typeof a.contenu}) : le code actuel ne saurait pas le lire.`;
  }
  if (!a.contenu.trim()) return '⚠️ Réponse vide.';
  if (a.fin === 'length' || a.fin === 'max_output_tokens') return '⚠️ Réponse tronquée : le plafond de tokens est atteint.';
  if (json) {
    try { JSON.parse(a.contenu); } catch { return '⚠️ Le texte reçu n\'est pas un JSON valide.'; }
  }
  if (r.duree > 150) return `⚠️ Réponse complète mais en ${r.duree.toFixed(0)} s : une Edge Function serait coupée vers 150 s.`;
  return '✅ Réponse complète, au format attendu.';
}

// Exécute un test, l'affiche en une ligne et le consigne en détail
async function test(numero, titre, modele, messages, options, { extrait = Infinity } = {}) {
  process.stdout.write(`${numero} ${titre} (${modele})… `);
  const essais = await generer(modele, messages, options);
  const dernier = essais[essais.length - 1];
  const a = analyser(dernier.r);
  const v = verdict(dernier.r, a, options);
  const adapte = essais.length > 1 ? ` — appel adapté : ${dernier.variante}` : '';
  const court = v.split(' : ')[0].replace(/\.$/, '');
  console.log(`${court} (${dernier.r.duree.toFixed(1)} s)${adapte}`);

  ecrire(`== ${numero} ${titre} — modèle ${modele} ==`);
  essais.forEach(({ variante, r }, i) => {
    ecrire(`Essai ${i + 1} : ${variante} → HTTP ${r.statut} en ${r.duree.toFixed(1)} s`);
    if (r.statut !== 200) ecrire(`  Message : ${message(r).slice(0, 500)}`);
  });
  ecrire(`Verdict : ${v}`);
  if (dernier.r.statut === 200) {
    ecrire(`Fin : ${a.fin} · Tokens : ${a.entree} en entrée, ${a.sortie} en sortie (dont ${a.raisonnement} de raisonnement), ${a.total} au total`);
    if (typeof a.contenu === 'string') {
      const texte = a.contenu.length > extrait ? `${a.contenu.slice(0, extrait)}\n[… ${a.contenu.length - extrait} caractères de plus]` : a.contenu;
      ecrire(`Texte reçu (${a.contenu.length} caractères) :`);
      ecrire(texte);
    } else {
      ecrire(`Contenu brut : ${JSON.stringify(a.contenu).slice(0, 800)}`);
    }
  }
  ecrire();
  return { statut: dernier.r.statut, adapte: essais.length > 1 };
}

async function main() {
  if (typeof fetch !== 'function') {
    console.error('Node 18 ou plus récent est nécessaire. Tape « node -v » pour voir ta version.');
    process.exit(1);
  }
  console.log(`\nTest du modèle ${MODELE} pour ProfAssist`);
  console.log('Prompts fictifs, aucune donnée d\'élève. La clé n\'est ni affichée ni enregistrée.\n');

  CLE = (process.env.OPENAI_API_KEY || '').trim()
    || await demanderCleMasquee('Colle ta clé API OpenAI ci-dessous puis appuie sur Entrée (rien ne s\'affiche, c\'est normal) :');
  if (!CLE.startsWith('sk-')) {
    console.error('Clé absente ou incomplète : une clé OpenAI commence par « sk- ».');
    process.exit(1);
  }
  console.log(`Clé reçue (${CLE.length} caractères). Les tests prennent une à trois minutes.\n`);

  ecrire(`Test du modèle ${MODELE} pour ProfAssist — ${new Date().toISOString()}`);
  ecrire(`API : ${API} · Node ${process.version} · aucune clé dans ce fichier`);
  ecrire();

  // 1. Accès au modèle
  process.stdout.write(`1/6 Accès au modèle (${MODELE})… `);
  const acces = await appel(`/models/${encodeURIComponent(MODELE)}`);
  const accesOk = acces.statut === 200;
  console.log(accesOk ? '✅ Accessible avec cette clé' : `❌ HTTP ${acces.statut}`);
  ecrire(`== 1/6 Accès au modèle — ${MODELE} ==`);
  ecrire(`HTTP ${acces.statut} : ${accesOk ? JSON.stringify(acces.donnees) : message(acces).slice(0, 500)}`);
  ecrire();

  if (accesOk) {
    // 2 et 3. Appréciation, comme la fonction generate (temperature 0.2, 1 000 tokens pour 400 caractères)
    await test('2/6', 'Appréciation', MODELE, APPRECIATION, { temperature: 0.2, maxTokens: 1000 });
    await test('3/6', 'Appréciation, modèle actuel pour comparer', REF_APPRECIATION, APPRECIATION, { temperature: 0.2, maxTokens: 1000, adapter: false });
    // 4. Mode JSON, comme communication-brief (temperature 0.2, 2 500 tokens)
    await test('4/6', 'Analyse en mode JSON', MODELE, ANALYSE_JSON, { temperature: 0.2, maxTokens: 2500, json: true });
    // 5 et 6. Génération longue, comme scenario (temperature 0.6, 5 500 tokens)
    await test('5/6', 'Génération longue', MODELE, SCENARIO, { temperature: 0.6, maxTokens: 5500 }, { extrait: 1500 });
    await test('6/6', 'Génération longue, modèle actuel pour comparer', REF_LONG, SCENARIO, { temperature: 0.6, maxTokens: 5500, adapter: false }, { extrait: 1500 });
  } else {
    const raison = acces.statut === 401
      ? 'la clé est refusée : vérifie qu\'elle a été collée en entier et qu\'elle est active'
      : acces.statut === 404
        ? 'ce compte n\'a pas accès au modèle (il peut exiger une vérification de l\'organisation dans le tableau de bord OpenAI)'
        : `l'API n'a pas répondu correctement (${acces.statut === 0 ? acces.brut : `HTTP ${acces.statut}`})`;
    console.log(`\nInutile d'aller plus loin : ${raison}.`);
    ecrire(`Tests suivants non lancés : ${raison}.`);
  }

  writeFileSync(FICHIER, `${rapport.join('\n')}\n`, 'utf8');
  console.log(`\nTerminé. Résultats complets dans :\n${FICHIER}\n`);
}

main().catch((e) => {
  console.error(`\nErreur inattendue : ${masquer(e?.message ?? e)}`);
  process.exit(1);
});
