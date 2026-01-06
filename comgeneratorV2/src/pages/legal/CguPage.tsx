// src/pages/legal/CguPage.tsx
import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';
import { Users, BookOpen, Zap, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

export function CguPage() {
  return (
    <LegalLayout 
      title="Conditions générales d'utilisation" 
      lastUpdated="6 janvier 2026"

    >
      <div className="space-y-8">
        
        {/* Introduction */}
        <section>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <Users className="w-8 h-8 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                Bienvenue sur ProfAssist
              </h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Les présentes conditions générales d'utilisation (CGU) définissent les règles d'accès et d'utilisation 
              de ProfAssist, plateforme d'intelligence artificielle dédiée aux enseignants. 
              En utilisant nos services, vous acceptez ces conditions dans leur intégralité.
            </p>
          </div>
        </section>

        {/* Définitions */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            1. Définitions
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🏢 "ProfAssist" ou "Nous"</h3>
                <p className="text-gray-700 text-sm">
                  La plateforme web et les services associés, édités par Lionel Delorenzo.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">👨‍🏫 "Utilisateur" ou "Vous"</h3>
                <p className="text-gray-700 text-sm">
                  Toute personne physique utilisant la plateforme ProfAssist.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🪙 "Tokens"</h3>
                <p className="text-gray-700 text-sm">
                  Unités de mesure de la consommation des services d'intelligence artificielle.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🤖 "Services d'IA"</h3>
                <p className="text-gray-700 text-sm">
                  Génération d'appréciations, synthèses, communications, séances pédagogiques, scénarios pédagogiques et chatbot personnalisé.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📚 "Corpus documentaire"</h3>
                <p className="text-gray-700 text-sm">
                  Ensemble des documents uploadés par l'utilisateur pour alimenter son chatbot personnalisé (technologie RAG).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🗺️ "Scénario pédagogique"</h3>
                <p className="text-gray-700 text-sm">
                  Vision macro d'une séquence d'apprentissage détaillant les objectifs, attendus et prérequis de chaque séance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Objet et champ d'application */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            2. Objet et champ d'application
          </h2>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                Services proposés
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• <strong>Génération d'appréciations :</strong> Création automatisée de commentaires personnalisés pour les bulletins scolaires</li>
                <li>• <strong>Synthèses de bulletins :</strong> Analyse et résumé automatique des commentaires d'une classe</li>
                <li>• <strong>Communications professionnelles :</strong> Rédaction d'emails, courriers et messages aux parents</li>
                <li>• <strong>Séances pédagogiques :</strong> Création de fiches de préparation de cours</li>
                <li>• <strong>Scénarios pédagogiques :</strong> Planification de séquences complètes avec objectifs, attendus et prérequis par séance</li>
                <li>• <strong>Chatbot personnalisé :</strong> Assistant IA interrogeable sur vos propres documents pédagogiques (programmes, fiches, cours)</li>
                <li>• <strong>Banques de données :</strong> Stockage et recherche de vos contenus (appréciations, séances, scénarios, réponses chatbot)</li>
                <li>• <strong>Gestion des tokens :</strong> Système de crédits pour l'utilisation des services d'IA</li>
              </ul>
            </div>
            
            <div className="bg-amber-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📋 Public cible</h3>
              <p className="text-gray-700">
                ProfAssist s'adresse exclusivement aux professionnels de l'éducation : enseignants, 
                professeurs, directeurs d'établissement, et autres personnels éducatifs dans le cadre de leur activité professionnelle.
              </p>
            </div>
          </div>
        </section>

        {/* Accès au service */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            3. Accès au service
          </h2>
          
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Création de compte
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• L'inscription est gratuite et ouverte aux enseignants</li>
                <li>• Une adresse email valide est requise</li>
                <li>• Vous devez fournir des informations exactes et les maintenir à jour</li>
                <li>• Un seul compte par utilisateur</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-blue-600" />
                Sécurité du compte
              </h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Vous êtes responsable de la confidentialité de vos identifiants</li>
                <li>• Nous recommandons l'utilisation d'un mot de passe fort et unique</li>
                <li>• Signalez immédiatement tout usage non autorisé de votre compte</li>
                <li>• Vous êtes responsable de toutes les activités réalisées sur votre compte</li>
              </ul>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-purple-600" />
                Disponibilité du service
              </h3>
              <p className="text-gray-700 mb-3">
                Nous nous efforçons d'assurer une disponibilité maximale de ProfAssist, mais nous ne garantissons pas un service ininterrompu.
              </p>
              <ul className="text-gray-700 space-y-1 text-sm">
                <li>• Maintenances programmées (notification préalable)</li>
                <li>• Interruptions techniques imprévisibles</li>
                <li>• Limitations liées aux services tiers (OpenAI, Stripe)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Système de tokens */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            4. Système de tokens
          </h2>
          
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🪙 Fonctionnement des tokens</h3>
              <p className="text-gray-700 mb-4">
                Les tokens sont des unités de mesure qui permettent d'utiliser nos services d'intelligence artificielle. 
                Un token correspond approximativement à 4 caractères de texte généré.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">💰 Consommation moyenne</h4>
                  <ul className="text-gray-700 text-sm space-y-1">
                    <li>• Appréciation : ~3000 tokens</li>
                    <li>• Synthèse : ~1800 tokens</li>
                    <li>• Communication : ~1000 tokens</li>
                    <li>• Séance : ~3500 tokens</li>
                    <li>• Scénario pédagogique : 8 000 à 10 000+ tokens</li>
                    <li>• Question chatbot : 2 000 à 4 000 tokens</li>

                  </ul>
                </div>
                
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">⏱️ Validité</h4>
                  <ul className="text-gray-700 text-sm space-y-1">
                    <li>• Les tokens n'ont pas de date d'expiration</li>
                    <li>• Ils restent disponibles tant que votre compte existe</li>
                    <li>• Non transférables entre comptes</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📤 Upload de documents (Chatbot)</h3>
              <p className="text-gray-700 mb-3">
                L'upload de documents pour alimenter votre chatbot personnel est <strong>gratuit et illimité</strong>. 
                Seules les questions posées au chatbot consomment des tokens.
              </p>
              <ul className="text-gray-700 text-sm space-y-1">
                <li>• Formats acceptés : PDF, DOCX, TXT</li>
                <li>• Taille maximale par fichier : 10 Mo</li>
                <li>• Documents stockés de manière sécurisée et privée</li>
              </ul>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="font-semibold text-amber-800 mb-3">
                ⚠️ Important à savoir
              </h3>
              <ul className="text-amber-700 space-y-2">
                <li>• La consommation réelle peut varier selon la complexité de votre demande</li>
                <li>• Les demandes partiellement traitées consomment des tokens</li>
                <li>• Aucun remboursement en cas d'erreur utilisateur</li>
                <li>• Les tokens gratuits d'inscription ne sont pas cumulables avec les achats</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Utilisation acceptable */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            5. Règles d'utilisation
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Usages autorisés */}
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-green-800 mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                ✅ Usages autorisés
              </h3>
              <ul className="text-green-700 space-y-2 text-sm">
                <li>• Création d'appréciations pour vos élèves</li>
                <li>• Rédaction de communications professionnelles</li>
                <li>• Préparation de séances et scénarios pédagogiques</li>
                <li>• Synthèses de bulletins de votre classe</li>
                <li>• Upload de documents pédagogiques officiels ou personnels</li>
                <li>• Interrogation du chatbot sur vos documents</li>
                <li>• Sauvegarde de contenus dans vos banques personnelles</li>
                <li>• Usage dans le cadre professionnel éducatif</li>
                <li>• Adaptation du contenu généré selon vos besoins</li>
              </ul>
            </div>
            
            {/* Usages interdits */}
            <div className="bg-red-50 rounded-lg p-6">
              <h3 className="font-semibold text-red-800 mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                ❌ Usages interdits
              </h3>
              <ul className="text-red-700 space-y-2 text-sm">
                <li>• Revente ou partage de votre compte</li>
                <li>• Génération de contenu offensant ou discriminatoire</li>
                <li>• Utilisation pour des contenus non éducatifs</li>
                <li>• Tentative de contournement du système de tokens</li>
                <li>• Automation abusive (bots, scripts)</li>
                <li>• Violation des droits d'auteur d'autrui</li>
                <li>• Usage commercial en dehors du cadre éducatif</li>
                <li>• Upload de documents contenant des données sensibles d'élèves</li>
                <li>• Upload de contenus illicites ou protégés sans autorisation</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-6 mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">🎯 Bonnes pratiques recommandées</h3>
            <ul className="text-gray-700 space-y-2">
              <li>• Vérifiez toujours le contenu généré avant utilisation</li>
              <li>• Personnalisez les résultats selon vos élèves</li>
              <li>• Respectez la confidentialité des données de vos élèves</li>
              <li>• Utilisez ProfAssist comme un assistant, pas un remplaçant</li>
              <li>• Pour le chatbot, privilégiez les documents officiels (programmes, BO) pour des réponses fiables</li>
            </ul>
          </div>
        </section>

        {/* Propriété intellectuelle */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            6. Propriété intellectuelle
          </h2>
          
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🏢 Propriété de ProfAssist</h3>
              <p className="text-gray-700 mb-3">
                ProfAssist, son code source, son design, ses algorithmes, sa marque et tous les éléments qui le composent 
                sont protégés par le droit de la propriété intellectuelle.
              </p>
              <p className="text-gray-600 text-sm">
                Toute reproduction, représentation ou utilisation non autorisée est strictement interdite.
              </p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">👨‍🏫 Votre propriété</h3>
              <p className="text-gray-700 mb-3">
                <strong>Le contenu que vous générez avec ProfAssist vous appartient entièrement.</strong> 
                Vous en êtes l'auteur et pouvez l'utiliser librement dans le cadre de votre activité professionnelle.
              </p>
              <ul className="text-gray-700 space-y-1">
                <li>• Appréciations créées</li>
                <li>• Synthèses générées</li>
                <li>• Communications rédigées</li>
                <li>• Séances et scénarios pédagogiques</li>
                <li>• Réponses du chatbot sauvegardées</li>
              </ul>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📝 Documents uploadés (Chatbot)</h3>
              <p className="text-gray-700 mb-3">
                Vous restez propriétaire des documents que vous uploadez dans votre chatbot. 
                Nous ne revendiquons aucun droit sur ces contenus.
              </p>
              <p className="text-gray-700">
                Vous garantissez que les documents uploadés ne violent aucun droit de propriété intellectuelle 
                et que vous disposez de tous les droits nécessaires pour leur utilisation dans le cadre du service.
              </p>
            </div>
          </div>
        </section>

        {/* Responsabilité */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            7. Responsabilité
          </h2>
          
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="font-semibold text-amber-800 mb-3">
                ⚖️ Responsabilité de l'utilisateur
              </h3>
              <ul className="text-amber-700 space-y-2">
                <li>• Vous êtes responsable de l'usage que vous faites du contenu généré</li>
                <li>• Vous devez vérifier la pertinence et l'exactitude avant utilisation</li>
                <li>• Vous respectez la réglementation applicable à votre profession</li>
                <li>• Vous protégez la confidentialité des données de vos élèves</li>
                <li>• Vous êtes responsable des documents que vous uploadez dans le chatbot</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🏢 Responsabilité de ProfAssist</h3>
              <p className="text-gray-700 mb-3">
                Nous nous engageons à fournir un service de qualité, mais notre responsabilité est limitée :
              </p>
              <ul className="text-gray-700 space-y-2">
                <li>• Nous ne garantissons pas la perfection du contenu généré par l'IA</li>
                <li>• Notre responsabilité est limitée au montant des tokens consommés</li>
                <li>• Nous ne sommes pas responsables des décisions pédagogiques prises</li>
                <li>• Exclusion de responsabilité pour les dommages indirects</li>
                <li>• Les réponses du chatbot sont basées sur vos documents et peuvent contenir des erreurs</li>
              </ul>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="font-semibold text-red-800 mb-3">
                🚫 Limitations importantes
              </h3>
              <p className="text-red-700">
                ProfAssist est un outil d'assistance. L'intelligence artificielle peut commettre des erreurs. 
                Il relève de votre responsabilité professionnelle de valider et adapter tout contenu avant utilisation.
                Les réponses du chatbot doivent être vérifiées, notamment pour les informations réglementaires.
              </p>
            </div>
          </div>
        </section>

        {/* Suspension et résiliation */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            8. Suspension et résiliation
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-orange-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">🚫 Suspension par ProfAssist</h3>
              <p className="text-gray-700 mb-3">
                Nous pouvons suspendre votre compte en cas de :
              </p>
              <ul className="text-gray-700 space-y-1 text-sm">
                <li>• Non-respect des présentes CGU</li>
                <li>• Usage abusif ou frauduleux</li>
                <li>• Comportement nuisant à la plateforme</li>
                <li>• Impayés ou chargebacks répétés</li>
                <li>• Upload de contenus illicites</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">✋ Résiliation par l'utilisateur</h3>
              <p className="text-gray-700 mb-3">
                Vous pouvez résilier votre compte à tout moment :
              </p>
              <ul className="text-gray-700 space-y-1 text-sm">
                <li>• Suppression directe depuis votre dashboard</li>
                <li>• Demande par email à notre support</li>
                <li>• Effet immédiat, sans préavis</li>
                <li>• Conservation des données selon nos CGU</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
            <h3 className="font-semibold text-red-800 mb-3">
              ⚠️ Conséquences de la résiliation
            </h3>
            <ul className="text-red-700 space-y-2">
              <li>• Perte d'accès immédiate à votre compte</li>
              <li>• Tokens non utilisés perdus (aucun remboursement)</li>
              <li>• Suppression progressive de vos données personnelles</li>
              <li>• Suppression de vos documents uploadés et de votre corpus chatbot</li>
              <li>• Conservation des données de facturation selon obligations légales</li>
            </ul>
          </div>
        </section>

        {/* Force majeure */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            9. Force majeure
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 mb-4">
              Nous ne pourrons être tenus responsables de tout retard ou inexécution consécutif à la survenance d'un cas de force majeure habituellement reconnu par la jurisprudence française.
            </p>
            <p className="text-gray-700 mb-3">
              <strong>Sont considérés comme cas de force majeure :</strong>
            </p>
            <ul className="text-gray-700 space-y-1">
              <li>• Catastrophes naturelles</li>
              <li>• Actes gouvernementaux, guerres, troubles sociaux</li>
              <li>• Défaillance majeure des services tiers (OpenAI, hébergeurs)</li>
              <li>• Cyberattaques d'envergure</li>
              <li>• Pannes généralisées d'infrastructure internet</li>
            </ul>
          </div>
        </section>

        {/* Modifications des CGU */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            10. Modification des conditions
          </h2>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📝 Évolution des CGU</h3>
              <p className="text-gray-700 mb-4">
                Ces conditions générales peuvent être modifiées à tout moment pour s'adapter aux évolutions légales, 
                techniques ou commerciales de ProfAssist.
              </p>
              <p className="text-gray-700">
                Les modifications substantielles vous seront notifiées par email et/ou via une notification sur votre dashboard 
                au moins 30 jours avant leur entrée en vigueur.
              </p>
            </div>
            
            <div className="bg-amber-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">⚖️ Acceptation des modifications</h3>
              <p className="text-gray-700 mb-4">
                La poursuite de l'utilisation de ProfAssist après l'entrée en vigueur de nouvelles conditions vaut acceptation de votre part.
              </p>
              <p className="text-gray-700">
                Si vous n'acceptez pas les nouvelles conditions, vous devez cesser d'utiliser le service et supprimer votre compte.
              </p>
            </div>
          </div>
        </section>

        {/* Droit applicable */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            11. Droit applicable et juridiction
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 mb-4">
              Les présentes conditions générales sont soumises au droit français.
            </p>
            <p className="text-gray-700 mb-4">
              En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. 
              À défaut d'accord dans un délai de 60 jours, les tribunaux français seront seuls compétents.
            </p>
            <p className="text-gray-700">
              <strong>Juridiction compétente :</strong> Tribunaux du lieu du siège social de ProfAssist ou du domicile du défendeur.
            </p>
          </div>
        </section>

        {/* Divisibilité */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            12. Divisibilité
          </h2>
          <div className="bg-blue-50 rounded-lg p-6">
            <p className="text-gray-700">
              Si une ou plusieurs stipulations des présentes conditions générales sont tenues pour non valides ou déclarées comme telles 
              en application d'une loi, d'un règlement ou à la suite d'une décision définitive d'une juridiction compétente, 
              les autres stipulations garderont toute leur force et leur portée.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            13. Contact et support
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📧 Support utilisateur</h3>
              <p className="text-gray-700 mb-3">
                Pour toute question sur l'utilisation de ProfAssist :
              </p>
              <a 
                href="mailto:contact-profassist@teachtech.fr" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                contact-profassist@teachtech.fr
              </a>
              <p className="text-gray-600 text-sm mt-2">
                Réponse sous 48h ouvrées
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">⚖️ Questions juridiques</h3>
              <p className="text-gray-700 mb-3">
                Pour toute question concernant ces CGU :
              </p>
              <p className="text-gray-600 text-sm">
                Lionel Delorenzo<br />
                Busloup, France<br />
                <a href="mailto:contact-profassist@teachtech.fr" className="text-blue-600 hover:text-blue-700">
                  contact-profassist@teachtech.fr
                </a>
              </p>
            </div>
          </div>
          
          <div className="mt-6 bg-white rounded-lg p-4">
            <p className="text-gray-700 text-sm">
              💡 <strong>Conseil :</strong> Conservez une copie de ces conditions générales. 
              La version en vigueur est toujours accessible sur cette page avec la date de dernière mise à jour.
            </p>
          </div>
        </section>

        {/* Acceptation */}
        <section className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-4">
            ✅ Acceptation des conditions
          </h2>
          <p className="text-green-700 leading-relaxed">
            En utilisant ProfAssist, vous reconnaissez avoir lu, compris et accepté l'intégralité de ces conditions générales d'utilisation. 
            Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.
          </p>
          <div className="mt-4 bg-white rounded-lg p-4">
            <p className="text-gray-700 text-sm">
              <strong>Date d'acceptation :</strong> Lors de la création de votre compte ou de la première utilisation après modification des CGU.
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
