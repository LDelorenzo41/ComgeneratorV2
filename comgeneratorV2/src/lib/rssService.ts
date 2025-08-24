// src/lib/rssService.ts
export interface RSSArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  feed_id: string;
}

export interface RSSFeed {
  id: string;
  name: string;
  url: string;
  proxyUrl: string;
}

const RSS_FEEDS: RSSFeed[] = [
  {
    id: 'a4f36406-9ddc-44ad-9947-4f2ffbc7cb3b',
    name: 'Le Café pédagogique – Tous articles',
    url: 'https://www.cafepedagogique.net/feed/',
    proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.cafepedagogique.net%2Ffeed%2F'
  },
  {
    id: 'ae941c71-ea03-45a1-a326-c6c5cee0bc96',
    name: 'VousNousIls – Tous articles',
    url: 'https://www.vousnousils.fr/feed',
    proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.vousnousils.fr%2Ffeed'
  },
  {
  id: '333b0ed2-3976-42a2-9eec-05e28477dfc2', // BON ID (celui de la BDD)
  name: 'Éduscol – Toute l\'actualité', // Nom de la BDD
  url: 'https://eduscol.education.fr/rid271/toute-l-actualite-du-site.rss',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feduscol.education.fr%2Frid271%2Ftoute-l-actualite-du-site.rss'
},
  {
    id: 'd9b61dc0-5b3e-4e3c-a055-c4c1936ce396',
    name: 'Édubase – Éducation Physique et Sportive (EPS)',
    url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Éducation%20Physique%20et%20Sportive',
    proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3D%25C3%2589ducation%2520Physique%2520et%2520Sportive'
  },
  {
    id: 'c7a6e1a7-4f82-4b6e-8f4b-2e8b6e2d9a3e', // Nouvel ajout
    name: 'Édubase – Arts Plastiques',
    url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Arts%20plastiques',
    proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DArts%2520plastiques'
  },
  {
  id: 'f5a8c9e0-1b3d-4f7c-a8e6-9d0b1a2c3f4e', // Nouvel ID unique
  name: 'Édubase – Biotechnologies et ST2S',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Biotechnologies%20et%20ST2S',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DBiotechnologies%2520et%2520ST2S'
},
// ... (vos autres flux)
{
  id: 'e1c0b3d5-6f7a-4b9e-8c1d-2a5f4e3b2c1a',
  name: 'Édubase – Documentation',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Documentation',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DDocumentation'
},
{
  id: 'a2b1c4e6-8d9f-4a7b-9e8c-3d6f5a4b3c2b',
  name: 'Édubase – Économie et gestion',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=%C3%89conomie%20et%20gestion',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3D%25C3%2589conomie%2520et%2520gestion'
},
{
  id: 'd3c2b5f7-9a8b-4c6d-8f9e-4e7a6b5c4d3c',
  name: 'Édubase – Éducation aux Médias et à l’Information',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=%C3%89ducation%20aux%20M%C3%A9dias%20et%20%C3%A0%20l%E2%80%99Information',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3D%25C3%2589ducation%2520aux%2520M%25C3%25A9dias%2520et%2520%25C3%25A0%2520l%25E2%2580%2599Information'
},
// ... (vos autres flux)
{
  id: '1e8a4c6a-7b3c-4d5e-8f2a-9c6b1a3d5e7f', // ID valide
  name: 'Édubase – Éducation musicale',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=%C3%89ducation%20musicale',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3D%25C3%2589ducation%2520musicale'
},
{
  id: 'f2b9a5c8-6d4e-4b7f-9a1c-8e3b2d5c7a9b', // ID valide
  name: 'Édubase – Enseignement Moral et Civique',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Enseignement%20Moral%20et%20Civique',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DEnseignement%2520Moral%2520et%2520Civique'
},
{
  id: 'a3c8b7d6-5e6f-4a9b-8c2d-7f4a1b3c5d6e', // ID valide
  name: 'Édubase – Français',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Fran%C3%A7ais',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DFran%25C3%25A7ais'
},
// ... (vos autres flux)
{
  id: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
  name: 'Édubase – Histoire des Arts',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Histoire%20des%20Arts',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DHistoire%2520des%2520Arts'
},
{
  id: 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f',
  name: 'Édubase – Histoire / Géographie',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Histoire%20/%20G%C3%A9ographie',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DHistoire%2520%2F%2520G%25C3%25A9ographie'
},
{
  id: 'd3e4f5a6-b7c8-4d9e-a0f1-2b3c4d5e6f7a',
  name: 'Édubase – Langues et Cultures de l\'Antiquité',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Langues%20et%20Cultures%20de%20l%27Antiquit%C3%A9',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DLangues%2520et%2520Cultures%2520de%2520l%2527Antiquit%25C3%25A9'
},
{
  id: 'e4f5a6b7-c8d9-4e0f-b1a2-3c4d5e6f7a8b',
  name: 'Édubase – Langues vivantes',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Langues%20vivantes',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DLangues%2520vivantes'
},
// REMPLACEZ les 5 objets correspondants dans votre fichier rssService.ts par CE BLOC :
{
  id: 'f0a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c', // Mathématiques (ID Corrigé)
  name: 'Édubase – Mathématiques',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Math%C3%A9matiques',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DMath%25C3%25A9matiques'
},
{
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', // Philosophie (ID Corrigé)
  name: 'Édubase – Philosophie',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Philosophie',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DPhilosophie'
},
{
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', // Physique / Chimie (ID Corrigé)
  name: 'Édubase – Physique / Chimie',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Physique%20/%20Chimie',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DPhysique%2520%2F%2520Chimie'
},
{
  id: 'c3d4e5f6-a7b8-4c9d-a0e1-2f3a4b5c6d7f', // SVT (ID Corrigé)
  name: 'Édubase – Sciences de la Vie et de la Terre',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Sciences%20de%20la%20Vie%20et%20de%20la%20Terre',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DSciences%2520de%2520la%2520Vie%2520et%2520de%2520la%2520Terre'
},
{
  id: 'd4e5f6a7-b8c9-4d0e-b1f2-3a4b5c6d7e8a', // SES (ID Corrigé)
  name: 'Édubase – Sciences Économiques et Sociales',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Sciences%20%C3%89conomiques%20et%20Sociales',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DSciences%2520%25C3%2589conomiques%2520et%2520Sociales'
},
// ... (vos autres flux)
{
  id: 'e5f6a7b8-c9d0-4e1f-b2c3-d4e5f6a7b8c9',
  name: 'Édubase – SNT / NSI',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Sciences%20Num%C3%A9riques%20et%20Technologie%20/%20Num%C3%A9rique%20et%20Sciences%20Informatiques',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DSciences%2520Num%25C3%25A9riques%2520et%2520Technologie%2520%2F%2520Num%25C3%25A9rique%2520et%2520Sciences%2520Informatiques'
},
{
  id: 'f6a7b8c9-d0e1-4f2a-b3c4-d5e6f7a8b9c0',
  name: 'Édubase – Technologie',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Technologie',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Fdiscipline%5B0%5D%3DTechnologie'
},
// ... (vos autres flux)
{
  id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e8f0a1b2c3d',
  name: 'Édubase – Scénarios pédagogiques nationaux',
  url: 'https://edubase.eduscol.education.fr/rss/rss.xml?academie[0]=Minist%C3%A8re%20de%20l%27%C3%89ducation%20nationale',
  proxyUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fedubase.eduscol.education.fr%2Frss%2Frss.xml%3Facademie%5B0%5D%3DMinist%25C3%25A8re%2520de%2520l%2527%25C3%2589ducation%2520nationale'
}
];

class RSSService {
  private cache = new Map<string, { data: RSSArticle[], timestamp: number }>();
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  async fetchFeed(feed: RSSFeed): Promise<RSSArticle[]> {
    try {
      console.log(`🔄 Récupération ${feed.name}...`);
      
      const response = await fetch(feed.proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} pour ${feed.name}`);
      }

      const data = await response.json();
      
      if (data.status !== 'ok') {
        throw new Error(`API Error: ${data.message || 'Erreur inconnue'}`);
      }

      const articles: RSSArticle[] = data.items.slice(0, 10).map((item: any) => ({
        title: this.cleanHtml(item.title || ''),
        description: this.cleanHtml(item.description || ''),
        link: item.link || '',
        pubDate: item.pubDate || new Date().toISOString(),
        source: feed.name,
        feed_id: feed.id
      }));

      console.log(`✅ ${feed.name}: ${articles.length} articles`);
      return articles;
      
    } catch (error) {
      console.error(`❌ Erreur ${feed.name}:`, error);
      return [];
    }
  }

  async fetchAllFeeds(): Promise<RSSArticle[]> {
    console.log('🚀 Récupération de tous les flux RSS...');
    
    const results = await Promise.allSettled(
      RSS_FEEDS.map(feed => this.fetchFeed(feed))
    );

    const allArticles = results
      .filter((result): result is PromiseResolvedResult<RSSArticle[]> => result.status === 'fulfilled')
      .flatMap(result => result.value);

    // Trier par date
    allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    console.log(`📰 Total: ${allArticles.length} articles récupérés`);
    return allArticles;
  }

  async fetchWithCache(): Promise<RSSArticle[]> {
    const now = Date.now();
    const cached = this.cache.get('all-articles');

    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      console.log('📦 Utilisation du cache RSS');
      return cached.data;
    }

    const articles = await this.fetchAllFeeds();
    this.cache.set('all-articles', { data: articles, timestamp: now });
    return articles;
  }

  private cleanHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  getAllFeeds(): RSSFeed[] {
    return RSS_FEEDS;
  }
}

export const rssService = new RSSService();