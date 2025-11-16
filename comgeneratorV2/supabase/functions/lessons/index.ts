// supabase/functions/lessons/index.ts

// @ts-ignore - Deno global disponible en runtime

// ⭐ MODIFICATION : Ajout de documentContext optionnel
interface LessonRequest {
  subject: string;
  topic: string;
  level: string;
  pedagogy_type: string;
  duration: string;
  documentContext?: string;  // ⭐ NOUVEAU - Texte extrait du PDF
}

const lessonsHandler = async (req: Request): Promise<Response> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const data: LessonRequest = await req.json();

    // Reproduction exacte des pédagogies de votre code
    const pedagogies = [
      {
        value: 'traditionnelle',
        label: 'Pédagogie traditionnelle',
        description: "Méthode centrée sur la transmission directe des savoirs de l'enseignant vers les élèves (exposés, leçons magistrales, démonstration), favorisant la mémorisation et l'acquisition des bases."
      },
      {
        value: 'active',
        label: 'Pédagogie active',
        description: "L'élève est acteur de son apprentissage : il explore, manipule, agit. Favorise l'expérimentation, la résolution de problèmes concrets, seul ou en groupe."
      },
      {
        value: 'projet',
        label: 'Pédagogie de projet',
        description: "Le savoir est mobilisé autour d'un projet concret (exposé, création, enquête). Les élèves planifient, réalisent, évaluent, ce qui développe leur autonomie."
      },
      {
        value: 'cooperatif',
        label: 'Apprentissage coopératif',
        description: "Les élèves travaillent en groupes pour résoudre des tâches ou projets, développant entraide, communication et responsabilisation."
      },
      {
        value: 'differenciee',
        label: 'Pédagogie différenciée',
        description: "Enseignement adapté aux besoins, rythmes et niveaux des élèves, avec des tâches variées et un accompagnement personnalisé."
      },
      {
        value: 'objectifs',
        label: 'Pédagogie par objectifs',
        description: "L'apprentissage est organisé autour d'objectifs clairs (compétences à atteindre, comportements observables). Permet un suivi précis de la progression."
      },
      {
        value: 'problemes',
        label: 'Apprentissage par problèmes (ABP)',
        description: "Les élèves doivent résoudre un problème complexe ou répondre à une question de recherche en mobilisant différentes connaissances."
      },
      {
        value: 'inverse',
        label: 'Enseignement inversé',
        description: "La théorie est étudiée à la maison (vidéos, docs), et la classe sert à pratiquer, échanger, approfondir."
      },
      {
        value: 'jeu',
        label: 'Apprentissage par le jeu',
        description: "Utilisation de jeux éducatifs, simulations ou jeux de rôle pour faciliter l'acquisition de compétences scolaires et sociales."
      }
    ];

    const pedagogyDescription = pedagogies.find(p => p.value === data.pedagogy_type)?.description ?? data.pedagogy_type;

    // ⭐ MODIFICATION : Prompt enrichi avec contexte documentaire
    const prompt = `Tu es un expert en ingénierie pédagogique et en didactique, spécialisé dans la conception de séances d'enseignement primaire et secondaire.

**CONTEXTE DE LA SÉANCE :**
- Matière : ${data.subject}
- Thème/Notion : ${data.topic}
- Niveau : ${data.level}
- Durée : ${data.duration} minutes
- Approche pédagogique : ${pedagogyDescription}

${data.documentContext ? `
**📎 DOCUMENT DE RÉFÉRENCE FOURNI PAR L'ENSEIGNANT :**

L'enseignant a fourni un document de contexte (bulletin officiel, programme, manuel, exercices...) pour guider la conception de cette séance.
Voici le contenu extrait de ce document :

---
${data.documentContext}
---

**Consigne importante :** Utilise les informations de ce document pour :
- Aligner la séance avec les programmes officiels mentionnés
- Intégrer les compétences et objectifs spécifiques indiqués
- Respecter le niveau de difficulté et les prérequis décrits
- T'inspirer des exemples d'exercices ou d'activités fournis
- Adapter le vocabulaire et les concepts au cadre pédagogique précisé

Intègre ces éléments de manière naturelle dans la séance tout en respectant la structure demandée ci-dessous.

` : ''}

${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? 
`**🏃 SPÉCIFICITÉS EPS - INSTRUCTIONS PRIORITAIRES :**

**IMPÉRATIFS PÉDAGOGIQUES EPS :**
- **75% minimum d'activité motrice** : La séance doit être majoritairement composée d'exercices pratiques et de situations motrices
- **Progressivité des apprentissages** : Du simple au complexe, du global au spécifique
- **Sécurité active et passive** : Intégrer systématiquement les consignes de sécurité et l'échauffement
- **Différenciation motrice** : Adapter les exercices selon les niveaux d'habileté des élèves
- **Évaluation par l'action** : Privilégier l'observation des comportements moteurs et les critères de réalisation

**STRUCTURE SPÉCIFIQUE EPS (à respecter absolument) :**

### 🔥 **Phase 1 : Échauffement/Mise en activité** - [12-15 minutes sur ${data.duration} min]
**Activité motrice obligatoire :** [Exercices d'échauffement spécifiques à l'APSA, mobilisation articulaire, activation cardio-vasculaire]
**Exercices concrets :** [Détailler 3-4 exercices progressifs avec consignes de sécurité]
**Modalité :** [Collectif puis individuel/binômes]

### 💪 **Phase 2 : Apprentissage moteur principal** - [${Math.floor((parseInt(data.duration) * 0.6))} minutes]
**Situation d'apprentissage 1 :** [Exercice technique spécifique avec critères de réalisation]
**Situation d'apprentissage 2 :** [Situation d'opposition/coopération ou perfectionnement technique]
**Situation d'apprentissage 3 :** [Mise en application complexe ou situation de jeu]
**Variables didactiques :** [Espace, temps, matériel, nombre de joueurs, règles...]

### 🎯 **Phase 3 : Mise en situation complexe/Jeu** - [${Math.floor((parseInt(data.duration) * 0.2))} minutes]
**Application pratique :** [Situation de match, parcours, ou évaluation pratique]
**Rôles des élèves :** [Joueurs, arbitres, observateurs, coaches...]

### 🧘 **Phase 4 : Retour au calme/Bilan** - [5-8 minutes]
**Récupération active :** [Étirements, relaxation, exercices respiratoires]
**Bilan moteur :** [Analyse des sensations, verbalisation des apprentissages]

**MATÉRIEL EPS SPÉCIFIQUE :**
- [Lister précisément tout le matériel sportif nécessaire]
- [Préciser l'aménagement des espaces et la sécurité]
- [Indiquer les alternatives en cas de manque de matériel]

**CRITÈRES DE RÉALISATION MOTRICE :**
- [Définir 3-4 critères observables pour évaluer la réussite technique]
- [Préciser les observables comportementaux et moteurs]
- [Adapter selon les niveaux d'habileté]

**SÉCURITÉ ET GESTION DE CLASSE :**
- [Consignes de sécurité spécifiques à l'APSA]
- [Gestion des groupes et rotations]
- [Signaux et codes de communication]

**DIFFÉRENCIATION MOTRICE :**
- **Élèves en difficulté motrice :** [Adaptations techniques, matériel adapté, simplifications]
- **Élèves experts :** [Complexifications, rôles de tuteur, défis supplémentaires]
- **Élèves en situation de handicap :** [Adaptations inclusives spécifiques]` 
: ''}

**CONSIGNES DE STRUCTURATION :**
Génère une séance pédagogique complète et directement exploitable en respectant OBLIGATOIREMENT cette structure Markdown :

# 📚 [Titre accrocheur de la séance]
**Niveau :** ${data.level} | **Durée :** ${data.duration} min | **Matière :** ${data.subject}

## 🎯 Objectifs et compétences visées
### Objectifs d'apprentissage
- [3-4 objectifs précis et mesurables]

### Compétences du socle/programmes officiels
- [Références aux programmes en vigueur]

## 🛠️ Matériel et supports nécessaires
### Pour l'enseignant
- [Liste détaillée]

### Pour les élèves
- [Liste détaillée]

${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ?
`### Espace et terrain
- [Configuration spatiale nécessaire]
- [Matériel sportif requis]
- [Consignes de sécurité]` : ''}

## 🏫 Organisation spatiale de la classe
> **💡 Configuration adaptée à la pédagogie ${data.pedagogy_type}**
- [Description précise de l'aménagement de l'espace selon la pédagogie choisie]
- [Disposition des élèves, des tables, des espaces de travail]

## ⏰ Déroulé détaillé de la séance

### 🚀 **Phase 1 : ${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? 'Échauffement/Mise en activité' : 'Accroche/Situation déclenchante'}** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - OBLIGATOIREMENT MOTRICE avec exercices concrets' : ''}]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? '**Consignes de sécurité :** [Précisions sécuritaires spécifiques]' : ''}

---

### 🔍 **Phase 2 : ${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? 'Apprentissage moteur principal' : '[Nom de la phase]'}** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - SITUATIONS MOTRICES DÉTAILLÉES avec critères de réalisation' : ''}]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? '**Variables didactiques :** [Adaptations possibles : espace, temps, règles...]' : ''}

---

### 🏗️ **Phase 3 : ${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? 'Mise en situation complexe/Application' : '[Nom de la phase]'}** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - SITUATION DE JEU OU APPLICATION COMPLEXE' : ''}]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

---

### 📝 **Phase 4 : ${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? 'Retour au calme/Bilan moteur' : 'Synthèse/Institutionnalisation'}** - [X minutes]
> **Modalité :** [Individuel/Groupe/Collectif]

**Activité :** [Description précise de l'activité${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - RETOUR AU CALME + VERBALISATION' : ''}]

**Rôle de l'enseignant :** [Actions concrètes de l'enseignant]

**Rôle des élèves :** [Actions attendues des élèves]

## 🎨 Différenciation et adaptations

### 🟢 Pour les élèves en difficulté${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' motrice' : ''}
- [3-4 adaptations concrètes${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' : matériel adapté, simplifications techniques, aides visuelles' : ''}]

### 🔵 Pour les élèves à l'aise${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? '/experts moteurs' : ''}
- [3-4 enrichissements possibles${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' : complexifications, rôles de tuteur, défis supplémentaires' : ''}]

### ♿ Adaptations inclusives
- [Adaptations pour élèves à besoins particuliers${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' et situations de handicap moteur' : ''}]

## 📊 Évaluation et critères de réussite

### Critères de réussite observables
- **Critère 1 :** [Comportement/production attendue${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - CRITÈRE MOTEUR OBSERVABLE' : ''}]
- **Critère 2 :** [Comportement/production attendue${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - CRITÈRE TECHNIQUE MESURABLE' : ''}]
- **Critère 3 :** [Comportement/production attendue${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - CRITÈRE COMPORTEMENTAL EN SITUATION' : ''}]

### Modalités d'évaluation
- [${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? 'Observation directe des comportements moteurs/Auto-évaluation des sensations/Évaluation par les pairs' : 'Formative/Sommative/Auto-évaluation/Etc.'}]

## 💡 Conseils pratiques et anticipation

### ⚠️ Points de vigilance
- [Difficultés prévisibles et solutions${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - Focus sur la sécurité et la gestion des groupes' : ''}]

### 🗣️ Questions types à poser
- [5-6 questions pour guider les élèves${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - Verbalisation des sensations et analyse technique' : ''}]

### 🔄 Variantes possibles
- [Adaptations selon le contexte${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ', météo, matériel disponible' : ''}]

## 📈 Prolongements possibles
- **Séance suivante :** [Piste pour la continuité${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - Évolution des situations motrices' : ''}]
- **Interdisciplinarité :** [Liens avec d'autres matières]
- **À la maison :** [Travail personnel éventuel${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? ' - Pratique autonome, recherches' : ''}]

---
> **💻 Ressources numériques :** [Sites, apps, outils TICE recommandés]
> **📚 Pour aller plus loin :** [Ressources pédagogiques complémentaires]

**EXIGENCES QUALITÉ :**
1. Chaque timing doit être précis et la somme doit correspondre à ${data.duration} minutes
2. Les activités doivent être concrètes et directement réalisables
3. La pédagogie ${data.pedagogy_type} doit être clairement visible dans les modalités
4. Les consignes aux élèves doivent être formulées simplement
5. Prévoir des transitions fluides entre les phases
6. Intégrer des éléments de différenciation naturelle
${data.subject.toLowerCase().includes('eps') || data.subject.toLowerCase().includes('sport') ? '7. **PRIORITÉ EPS :** Au moins 75% d\'exercices pratiques et situations motrices avec critères techniques précis' : ''}

Génère maintenant cette séance en respectant scrupuleusement cette structure et en étant très concret dans toutes les descriptions.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      return new Response('OpenAI API Error', { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const openAIData = await response.json();
    const content = openAIData.choices?.[0]?.message?.content;
    
    if (!content) {
      return new Response(JSON.stringify({
        error: 'Réponse invalide de l\'API OpenAI'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      content,
      usage: openAIData.usage
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error('Lessons function error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
};

Deno.serve(lessonsHandler);