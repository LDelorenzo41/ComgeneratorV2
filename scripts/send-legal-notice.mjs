#!/usr/bin/env node
// Envoi de l'e-mail « mise à jour des conditions » (docs/email-maj-cgu-aout-2026.html)
// via l'API transactionnelle Resend — un destinataire par requête, jamais de Broadcast.
//
// Usage (depuis la racine du dépôt, Node 18 ou plus) :
//   node scripts/send-legal-notice.mjs emails.csv                      # répétition générale : compte, n'envoie rien
//   node scripts/send-legal-notice.mjs emails.csv --test moi@exemple.fr # envoie UN e-mail de test à cette adresse
//   node scripts/send-legal-notice.mjs emails.csv --go                 # envoi réel à toute la liste
//
// La clé API est lue dans RESEND_API_KEY (Resend → API Keys) :
//   RESEND_API_KEY=re_xxx node scripts/send-legal-notice.mjs emails.csv --go
//
// emails.csv : une adresse par ligne (l'export CSV du dashboard Supabase convient tel quel,
// l'en-tête « email » est ignoré). Fichier à supprimer après l'envoi.
//
// Reprise sur incident : chaque envoi réussi est consigné dans sent-legal-notice.log ;
// relancer la même commande ignore les adresses déjà servies. Supprimer ce fichier
// après l'envoi, comme la liste.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Paramètres de la campagne ────────────────────────────────────────────────
const SUBJECT = 'Rentrée 2026 — ce qui change dans ProfAssist (conditions et données personnelles)';
const FROM = 'ProfAssist <contact-profassist@teachtech.fr>';
const REPLY_TO = 'contact-profassist@teachtech.fr';
// HTML et journal ancrés à la racine du dépôt (le dossier au-dessus de scripts/),
// pour que l'envoi et la reprise fonctionnent quel que soit le dossier de lancement.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = join(REPO_ROOT, 'docs', 'email-maj-cgu-aout-2026.html');
const SENT_LOG = join(REPO_ROOT, 'sent-legal-notice.log');
const DELAY_MS = 550; // cadence sous la limite Resend de 2 requêtes/seconde

// ── Lecture des arguments ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const listPath = args.find(a => !a.startsWith('--'));
const go = args.includes('--go');
const testIdx = args.indexOf('--test');
const testAddr = testIdx !== -1 ? args[testIdx + 1] : null;

if (!listPath && !testAddr) {
  console.error('Usage : node scripts/send-legal-notice.mjs <fichier-adresses> [--test adresse | --go]');
  process.exit(1);
}
const apiKey = process.env.RESEND_API_KEY;
if ((go || testAddr) && !apiKey) {
  console.error('RESEND_API_KEY manquante. Exemple : RESEND_API_KEY=re_xxx node scripts/send-legal-notice.mjs …');
  process.exit(1);
}

// ── Contenu : HTML sans les commentaires internes + version texte ────────────
const rawHtml = readFileSync(HTML_PATH, 'utf8');
const html = rawHtml.replace(/<!--[\s\S]*?-->/g, '').trim();

const ENTITIES = {
  '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&agrave;': 'à', '&ocirc;': 'ô',
  '&ucirc;': 'û', '&icirc;': 'î', '&ccedil;': 'ç', '&rsquo;': '’', '&nbsp;': ' ',
  '&mdash;': '—', '&middot;': '·', '&amp;': '&',
};
const text = html
  .replace(/<h2[^>]*>/g, '\n\n')
  .replace(/<\/(p|h2|div)>/g, '\n')
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, '$2 ($1)')
  .replace(/<[^>]+>/g, '')
  .replace(/&[a-z]+;/g, m => ENTITIES[m] ?? m)
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// ── Liste des destinataires ──────────────────────────────────────────────────
function loadRecipients(path) {
  const seen = new Set();
  const out = [];
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const addr = rawLine.replace(/^﻿/, '').replace(/["';,]/g, ' ').trim().split(/\s+/)[0] ?? '';
    if (!addr || addr.toLowerCase() === 'email') continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      console.warn(`  ligne ignorée (adresse invalide) : ${rawLine.trim()}`);
      continue;
    }
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

const alreadySent = new Set(
  existsSync(SENT_LOG)
    ? readFileSync(SENT_LOG, 'utf8').split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(Boolean)
    : []
);

// ── Envoi d'un e-mail, avec nouvelle tentative sur 429 / 5xx / réseau ────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sendOne(to) {
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: SUBJECT, html, text }),
      });
      if (res.ok) return { success: true };
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastError = `${res.status} ${body}`;
        await sleep(Math.pow(2, attempt + 1) * 500); // 1 s, 2 s, 4 s
        continue;
      }
      return { success: false, error: `${res.status} ${body}` }; // 4xx : inutile de réessayer
    } catch (err) {
      lastError = err.message;
      await sleep(Math.pow(2, attempt + 1) * 500);
    }
  }
  return { success: false, error: lastError };
}

// ── Modes ────────────────────────────────────────────────────────────────────
if (testAddr) {
  console.log(`Envoi de test à ${testAddr}…`);
  const r = await sendOne(testAddr);
  console.log(r.success ? '✅ Test envoyé — vérifier le rendu (ordinateur, téléphone, clair/sombre) et chaque lien.'
                        : `❌ Échec : ${r.error}`);
  process.exit(r.success ? 0 : 1);
}

const recipients = loadRecipients(listPath);
const pending = recipients.filter(a => !alreadySent.has(a.toLowerCase()));

console.log(`Objet       : ${SUBJECT}`);
console.log(`Expéditeur  : ${FROM}`);
console.log(`Liste       : ${recipients.length} adresses valides (${listPath})`);
console.log(`Déjà servies: ${recipients.length - pending.length} (${SENT_LOG})`);
console.log(`À envoyer   : ${pending.length}${pending.length ? ` — p. ex. ${pending.slice(0, 3).join(', ')}…` : ''}`);
console.log(`Durée estimée : ~${Math.ceil((pending.length * DELAY_MS) / 60000)} min\n`);

if (!go) {
  console.log('Répétition générale : rien n\'a été envoyé. Ajouter --go pour l\'envoi réel,');
  console.log('ou --test votre@adresse pour recevoir un exemplaire.');
  process.exit(0);
}

let ok = 0, ko = 0;
const failures = [];
for (let i = 0; i < pending.length; i++) {
  const to = pending[i];
  const r = await sendOne(to);
  if (r.success) {
    ok++;
    appendFileSync(SENT_LOG, to.toLowerCase() + '\n');
    console.log(`✅ [${i + 1}/${pending.length}] ${to}`);
  } else {
    ko++;
    failures.push(`${to} — ${r.error}`);
    console.error(`❌ [${i + 1}/${pending.length}] ${to} : ${r.error}`);
  }
  if (i < pending.length - 1) await sleep(DELAY_MS);
}

console.log(`\nTerminé : ${ok} envoyés, ${ko} échecs.`);
if (failures.length) {
  console.log('Échecs (relancer la même commande pour retenter — les envois réussis seront ignorés) :');
  failures.forEach(f => console.log('  ' + f));
}
console.log(`Penser à supprimer ${listPath} et ${SENT_LOG} une fois l'envoi terminé.`);
