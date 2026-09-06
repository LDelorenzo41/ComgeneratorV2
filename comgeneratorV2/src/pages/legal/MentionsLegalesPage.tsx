// src/pages/legal/MentionsLegalesPage.tsx
import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

export function MentionsLegalesPage() {
  return (
    <LegalLayout 
      title="Mentions légales" 
      lastUpdated="6 septembre 2026"
    >
      <div className="space-y-8">
        
        {/* Identification de l'éditeur */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            1. Identification de l'éditeur
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Éditeur</h3>
                <p className="text-gray-700">
                  Lionel Delorenzo<br />
                  Entrepreneur individuel (EI)
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Nom commercial</h3>
                <p className="text-gray-700">ProfAssist</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Responsable de publication</h3>
                <p className="text-gray-700">Lionel Delorenzo</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Siège social</h3>
                <p className="text-gray-700">
                  8 sentier du coteau<br />
                  41160 Busloup<br />
                  France
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Immatriculation</h3>
                <p className="text-gray-700">
                  SIREN : 929 482 107<br />
                  SIRET : 929 482 107 00018
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">TVA</h3>
                <p className="text-gray-700">
                  TVA non applicable, article 293 B du CGI
                </p>
              </div>
              <div className="md:col-span-2">
                <h3 className="font-semibold text-gray-900 mb-2">Contact</h3>
                <p className="text-gray-700">
                  Email : <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700">contact-profassist@teachtech.fr</a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Hébergement */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            2. Hébergement
          </h2>
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Hébergeur web</h3>
                <p className="text-gray-700">
                  Netlify, Inc.<br />
                  44 Montgomery Street<br />
                  Suite 300<br />
                  San Francisco, CA 94104<br />
                  États-Unis
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Base de données</h3>
                <p className="text-gray-700">
                  Supabase Inc.<br />
                  970 Toa Payoh North #07-04<br />
                  Singapore 318992<br />
                  Singapour
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Services utilisés */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            3. Services tiers utilisés
          </h2>
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Intelligence artificielle</h3>
              <p className="text-gray-700 mb-2">
                <strong>OpenAI</strong> — traitement des demandes de génération de contenu
              </p>
              <p className="text-gray-700 mb-2">
                <strong>Mistral AI</strong> (société française) — génération de contenu lorsque ce
                modèle est sélectionné dans vos paramètres, et transcription de la dictée vocale
              </p>
              <p className="text-gray-600 text-sm">
                Les données transmises à ces services sont soumises à leurs politiques de
                confidentialité respectives. Le détail des traitements figure dans notre{' '}
                <a href="/legal/politique-confidentialite" className="text-blue-600 hover:text-blue-700 underline">politique de confidentialité</a>.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Paiements</h3>
              <p className="text-gray-700 mb-2">
                <strong>Stripe</strong> — traitement sécurisé des paiements pour l'achat de tokens
              </p>
              <p className="text-gray-600 text-sm">
                Aucune donnée de carte bancaire n'est stockée sur nos serveurs.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Envoi d'e-mails</h3>
              <p className="text-gray-700 mb-2">
                <strong>Resend</strong> — acheminement de la newsletter, pour les seuls comptes qui
                s'y sont abonnés
              </p>
              <p className="text-gray-600 text-sm">
                Le désabonnement est possible à tout moment depuis vos réglages ou depuis le lien
                présent dans chaque envoi.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Sauvegarde</h3>
              <p className="text-gray-700 mb-2">
                <strong>GitHub, Inc.</strong> (groupe Microsoft) — conservation des sauvegardes
                chiffrées quotidiennes de la base de données
              </p>
              <p className="text-gray-600 text-sm">
                Les sauvegardes sont chiffrées avant tout envoi et conservées 90 jours.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Ce que nous n'utilisons pas</h3>
              <p className="text-gray-700">
                ProfAssist n'utilise <strong>aucun outil de mesure d'audience</strong> (ni Google
                Analytics, ni équivalent), <strong>aucune régie publicitaire</strong> et aucun
                traceur tiers. Votre navigation n'est transmise à personne.
              </p>
            </div>
          </div>
        </section>

        {/* Propriété intellectuelle */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            4. Propriété intellectuelle
          </h2>
          <div className="bg-amber-50 rounded-lg p-6">
            <p className="text-gray-700 leading-relaxed mb-4">
              Le site ProfAssist, sa structure, son design, ses textes, images, et tous les éléments qui le composent 
              sont protégés par le droit d'auteur.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments 
              du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Le contenu généré par l'utilisateur via nos outils d'IA lui appartient et peut être librement utilisé 
              dans le cadre de son activité professionnelle.
            </p>
          </div>
        </section>

        {/* Responsabilité */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            5. Limitation de responsabilité
          </h2>
          <div className="bg-red-50 rounded-lg p-6">
            <p className="text-gray-700 leading-relaxed mb-4">
              ProfAssist s'efforce de fournir des informations aussi précises que possible. 
              Toutefois, il ne pourra être tenu responsable des omissions, des inexactitudes et des carences dans la mise à jour.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              L'utilisateur est seul responsable de l'utilisation qu'il fait du contenu généré par l'intelligence artificielle 
              et doit s'assurer de sa pertinence avant utilisation.
            </p>
            <p className="text-gray-700 leading-relaxed">
              ProfAssist ne peut être tenu responsable en cas d'interruption temporaire du service pour maintenance 
              ou mise à jour.
            </p>
          </div>
        </section>

        {/* Droit applicable */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            6. Droit applicable
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 leading-relaxed">
              Les présentes mentions légales sont soumises au droit français. En cas de litige, 
              les tribunaux français seront seuls compétents.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            7. Contact
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Pour toute question concernant ces mentions légales ou le fonctionnement du site, 
            vous pouvez nous contacter :
          </p>
          <div className="bg-white rounded-lg p-4">
            <p className="text-gray-700">
              📧 <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700 font-medium">
                contact-profassist@teachtech.fr
              </a>
            </p>
            <p className="text-gray-600 text-sm mt-2">
              Nous nous engageons à répondre dans les plus brefs délais.
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}