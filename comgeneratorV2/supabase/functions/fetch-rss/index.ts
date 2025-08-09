import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { parse } from 'https://deno.land/x/xml@2.1.3/mod.ts';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts';

const RSS_FEEDS = [
  {
    url: 'https://www.cafepedagogique.net/feed/',
    source: 'Café Pédagogique'
  },
  {
    url: 'https://www.vousnousils.fr/feed',
    source: 'VousNousIls'
  },
  {
    url: 'https://edubase.eduscol.education.fr/rss/rss.xml?discipline[0]=Éducation%20Physique%20et%20Sportive',
    source: 'Édubase EPS'
  }
];

function cleanHtml(html: string): string {
  if (!html) return '';
  try {
    // Supprimer les balises CDATA si présentes
    html = html.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
    // Nettoyer le HTML basique
    return html
      .replace(/<[^>]*>/g, '') // Supprime les balises HTML
      .replace(/&nbsp;/g, ' ') // Remplace les espaces insécables
      .replace(/&amp;/g, '&') // Décode les entités HTML communes
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  } catch (error) {
    console.error('Erreur lors du nettoyage HTML:', error);
    return html;
  }
}

function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    // Nettoyer la chaîne de date
    const cleanDate = dateStr
      .replace(/^[a-z]{3},\s*/i, '') // Enlève le jour de la semaine
      .replace(/\s+\([^)]+\)/g, '') // Enlève les parenthèses
      .replace(/\s+[a-z]{3}(\s+|$)/i, ' ') // Enlève les fuseaux horaires textuels
      .trim();

    const date = new Date(cleanDate);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function extractImageFromContent(content: string, link: string): Promise<string | null> {
  try {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    if (!doc) return null;

    // Chercher d'abord une image avec media:content
    const mediaContent = doc.querySelector('media\\:content, content');
    if (mediaContent?.getAttribute('url')) {
      return mediaContent.getAttribute('url');
    }

    // Chercher ensuite une image dans le contenu
    const img = doc.querySelector('img');
    if (img?.getAttribute('src')) {
      const src = img.getAttribute('src');
      // Convertir en URL absolue si nécessaire
      return src.startsWith('http') ? src : new URL(src, new URL(link).origin).href;
    }

    // Si aucune image n'est trouvée, retourner null
    return null;
  } catch (error) {
    console.error('Erreur lors de l\'extraction de l\'image:', error);
    return null;
  }
}

async function fetchRSSFeed(feed: { url: string; source: string }) {
  try {
    console.log(`Fetching feed from ${feed.url}`);
    
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS-Reader/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    console.log(`Received XML content from ${feed.source}`);

    const parsed = parse(xmlText);
    const channel = parsed.rss?.channel;
    if (!channel) {
      throw new Error('Format RSS invalide: pas de canal trouvé');
    }

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    console.log(`Found ${items.length} items in ${feed.source} feed`);

    // Code NOUVEAU avec feed_id
const articles = await Promise.all(items.filter((item)=>item && typeof item === 'object').map(async (item)=>{
  const title = Array.isArray(item.title) ? item.title[0] : item.title;
  const description = Array.isArray(item.description) ? item.description[0] : item.description;
  const link = Array.isArray(item.link) ? item.link[0] : item.link;
  const pubDate = Array.isArray(item.pubDate) ? item.pubDate[0] : item.pubDate;
  const content = Array.isArray(item['content:encoded']) ? item['content:encoded'][0] : item['content:encoded'];
  const imageUrl = await extractImageFromContent(content || description || '', String(link || ''));
  
  return {
    title: cleanHtml(String(title || '')),
    description: cleanHtml(String(description || '')),
    link: String(link || '').trim(),
    source: feed.name,
    feed_id: feed.id, // ← LIGNE AJOUTÉE
    pub_date: parseDate(String(pubDate || '')),
    image_url: imageUrl
  };
}));

    const validArticles = articles.filter(article => article.title && article.link);
    console.log(`Successfully parsed ${validArticles.length} articles from ${feed.source}`);
    return validArticles;
  } catch (error) {
    console.error(`Error fetching ${feed.source}:`, error);
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    // Vérifier que la table articles existe
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Vérifier que la table existe
    const { error: tableCheckError } = await supabaseClient
      .from('articles')
      .select('count')
      .limit(1);

    if (tableCheckError) {
      throw new Error('La table articles n\'existe pas ou n\'est pas accessible');
    }

    const feedPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
    const feedResults = await Promise.all(feedPromises);
    const articles = feedResults.flat();

    if (articles.length === 0) {
      throw new Error('Aucun article n\'a pu être récupéré');
    }

    console.log(`Total articles retrieved: ${articles.length}`);

    // Supprimer les anciens articles
    const { error: deleteError } = await supabaseClient
      .from('articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      throw deleteError;
    }

    // Insérer les nouveaux articles
    const { error: insertError } = await supabaseClient
      .from('articles')
      .insert(articles);

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${articles.length} articles mis à jour avec succès (${RSS_FEEDS.length} sources)`
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});