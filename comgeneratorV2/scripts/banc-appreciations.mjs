#!/usr/bin/env node
// scripts/banc-appreciations.mjs
//
// Banc d'essai des appréciations : exécute la vraie Edge Function generate
// (version d'un commit git ET copie de travail), Supabase simulé, appels à
// l'IA réels, sur des cas types. Sert à valider un prompt ou un modèle AVANT
// déploiement (exemple : bascule vers GPT-6 Luna, novembre 2026).
//
//   node scripts/banc-appreciations.mjs [--modeles default,gpt-6-luna]
//        [--essais 1] [--reference HEAD] [--cas fichier.json]
//
// - Chaque modèle est essayé deux fois : prompt du commit de référence
//   (« déployé ») et prompt de la copie de travail (« modifié »).
// - Clé OpenAI : variable OPENAI_API_KEY. Dans une session Claude Code cloud,
//   la clé est injectée par le proxy : lancer avec NODE_USE_ENV_PROXY=1, sans clé.
// - Chaque cas peut lister des « attendus » (expressions régulières) que le
//   texte doit contenir : notes du professeur reprises, critère crucial nommé…
// - Cas fictifs, sans donnée d'élève réelle. Rapport écrit dans le dossier
//   temporaire du système (chemin affiché à la fin), hors du dépôt.
// Coût : quelques centimes par passage.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const APP = join(ICI, '..');
const FN = join(APP, 'supabase/functions');
const esbuild = createRequire(join(APP, 'package.json'))('esbuild');
const TMP = join(tmpdir(), 'banc-appreciations');
mkdirSync(TMP, { recursive: true });

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 ? process.argv[i + 1] : defaut;
};
const MODELES = arg('modeles', 'default,gpt-6-luna').split(',');
const ESSAIS = Number(arg('essais', '1'));
const REFERENCE = arg('reference', 'HEAD');
const CAS = JSON.parse(readFileSync(arg('cas', join(ICI, 'banc-appreciations-cas.json')), 'utf8'));
const CLE = process.env.OPENAI_API_KEY || 'proxy-injected';

// --- Charger la fonction generate d'une version donnée, en capturant son handler
function source(version) {
  if (version === 'copie') return join(FN, 'generate/index.ts');
  const racine = execFileSync('git', ['-C', APP, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const relatif = FN.slice(racine.length + 1);
  const dir = join(TMP, `src-${version}`);
  for (const f of ['generate/index.ts', '_shared/credits.ts']) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), execFileSync('git', ['-C', racine, 'show', `${version}:${relatif}/${f}`], { maxBuffer: 1e8 }));
  }
  return join(dir, 'generate/index.ts');
}
async function chargerHandler(version) {
  const sortie = join(TMP, `generate-${version.replace(/[^a-zA-Z0-9]/g, '_')}.mjs`);
  esbuild.buildSync({ entryPoints: [source(version)], bundle: true, platform: 'node', format: 'esm', outfile: sortie, logLevel: 'error' });
  let handler;
  const env = { SUPABASE_URL: 'https://supabase.banc', SUPABASE_SERVICE_ROLE_KEY: 'banc', OPENAI_API_KEY: CLE, MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || 'absente' };
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
  await import(`${sortie}?v=${Date.now()}`);
  return handler;
}

// --- fetch : Supabase simulé, appels à l'IA réels
const vraiFetch = globalThis.fetch;
let derniereRequete = null, dernierUsage = null;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith('https://supabase.banc/auth/v1/user')) return json({ id: '00000000-0000-4000-8000-000000000001' });
  if (u.includes('/rest/v1/profiles')) return json([{ tokens: 100000 }]);
  if (u.includes('/rest/v1/credit_ledger')) return json([]);
  if (u.includes('/rest/v1/rpc/consume_credits')) return json(99000);
  derniereRequete = JSON.parse(init.body || '{}');
  const rep = await vraiFetch(u, init);
  const texte = await rep.text();
  try { dernierUsage = JSON.parse(texte).usage ?? null; } catch { dernierUsage = null; }
  return new Response(texte, { status: rep.status, headers: { 'Content-Type': 'application/json' } });
};

const NIVEAUX = ['Non évalué', 'Très insuffisant', 'Insuffisant', 'Moyen', 'Assez bien', 'Bien', 'Très bien', 'Excellent'];
function alertes(cas, res) {
  const d = res.detailed || '', s = res.summary || '', a = [];
  if (!res.detailed) a.push(`pas d'appréciation (${res.error || 'réponse vide'})`);
  if (/aucun crit[èe]re/i.test(d + s)) a.push('phrase « Aucun critère… »');
  if (res.detailed && (d.length < cas.minLength || d.length > cas.maxLength)) a.push(`longueur ${d.length} hors ${cas.minLength}-${cas.maxLength}`);
  if (cas.addressMode === 'impersonnel' && /\b(tu|te|ton|ta|tes|vous|votre|vos)\b/i.test(d)) a.push('mode d\'adresse non respecté');
  if (cas.addressMode === 'tutoiement' && /\b(vous|votre|vos|l'élève)\b/i.test(d)) a.push('mode d\'adresse non respecté');
  if (cas.addressMode === 'vouvoiement' && /\b(tu|ton|ta|tes|l'élève|il|elle)\b/i.test(d)) a.push('mode d\'adresse non respecté');
  if (cas.hideStudentName && new RegExp(`\\b${cas.studentName}\\b`, 'i').test(d + s)) a.push('prénom présent malgré l\'anonymat');
  for (const motif of cas.attendus || []) if (!new RegExp(motif, 'i').test(d + s)) a.push(`attendu absent : ${motif}`);
  return a;
}

const variantes = MODELES.flatMap((m) => [
  { label: `${m === 'default' ? 'modèle par défaut' : m}, prompt déployé (${REFERENCE})`, version: REFERENCE, aiModel: m },
  { label: `${m === 'default' ? 'modèle par défaut' : m}, prompt modifié (copie)`, version: 'copie', aiModel: m },
]);
const handlers = {};
for (const v of variantes) handlers[v.version] ??= await chargerHandler(v.version);

const lignes = [`# Banc d'essai des appréciations — ${new Date().toISOString().slice(0, 16)}`, ''];
const bilan = new Map();
const logs = { log: console.log, warn: console.warn };
for (const cas of CAS) {
  lignes.push(`## ${cas.titre}`, '', `Critères : ${cas.criteria.filter((c) => c.value > 0).map((c) => `${c.name} = ${NIVEAUX[c.value]}`).join(' · ')}`,
    `Réglages : ${cas.addressMode}, ton ${cas.tone}, ${cas.minLength}-${cas.maxLength} caractères${cas.hideStudentName ? ', anonymat' : ''}`, '');
  for (const v of variantes) {
    for (let essai = 1; essai <= ESSAIS; essai++) {
      const params = { subject: cas.subject, criteria: cas.criteria, minLength: cas.minLength, maxLength: cas.maxLength, tone: cas.tone,
        addressMode: cas.addressMode, studentName: cas.studentName, personalNotes: cas.personalNotes || '', hideStudentName: cas.hideStudentName ?? false,
        ...(v.aiModel !== 'default' && { aiModel: v.aiModel }) };
      const debut = Date.now();
      let res = {}, statut = 0;
      console.log = console.warn = () => {};
      try {
        const r = await handlers[v.version](new Request('http://banc/generate', { method: 'POST', headers: { Authorization: 'Bearer banc', 'Content-Type': 'application/json' }, body: JSON.stringify(params) }));
        statut = r.status;
        res = await r.json().catch(() => ({}));
      } catch (e) {
        res = { error: e.message };
      } finally {
        Object.assign(console, logs);
      }
      const duree = (Date.now() - debut) / 1000;
      const a = alertes(cas, res);
      const raisonnement = dernierUsage?.completion_tokens_details?.reasoning_tokens ?? 0;
      lignes.push(`**${v.label}**${ESSAIS > 1 ? ` (essai ${essai})` : ''} — HTTP ${statut}, ${duree.toFixed(1)} s, ${dernierUsage?.total_tokens ?? '?'} tokens${raisonnement ? ` (dont ${raisonnement} de raisonnement)` : ''}${derniereRequete?.model ? `, ${derniereRequete.model}` : ''}${a.length ? ` — ⚠️ ${a.join(', ')}` : ''}`,
        '', `> ${(res.detailed || res.error || '(vide)').replace(/\n+/g, ' ')}`, '', `> *Synthétique :* ${(res.summary || '').replace(/\n+/g, ' ')}`, '');
      const b = bilan.get(v.label) || { n: 0, alertes: 0, duree: 0, tokens: 0 };
      bilan.set(v.label, { n: b.n + 1, alertes: b.alertes + a.length, duree: b.duree + duree, tokens: b.tokens + (dernierUsage?.total_tokens ?? 0) });
      console.log(`${cas.titre.slice(0, 38).padEnd(38)} ${v.label.slice(0, 44).padEnd(44)} ${statut} ${a.length ? '⚠️ ' + a.join(', ') : 'OK'}`);
    }
  }
}
lignes.push('## Bilan', '', '| Variante | Réponses | Alertes | Durée moyenne | Tokens moyens |', '|---|---|---|---|---|');
for (const [label, b] of bilan) lignes.push(`| ${label} | ${b.n} | ${b.alertes} | ${(b.duree / b.n).toFixed(1)} s | ${Math.round(b.tokens / b.n)} |`);
const rapport = join(TMP, `rapport-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`);
writeFileSync(rapport, `${lignes.join('\n')}\n`, 'utf8');
console.log(`\n${lignes.slice(lignes.indexOf('## Bilan') + 2).join('\n')}\n\nRapport complet : ${rapport}`);
